#!/usr/bin/env python3
"""Measure a real Meta ASR process on local CPU; no audio is uploaded.

Input manifest: [{"path":"absolute/or/manifest-relative.wav", "reference":"...",
                  "language":"en", "source":"synthetic|human"}].
Run separate processes per model/thread setting so memory is not carried over.
"""
import argparse
import gc
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import resource
import statistics
import threading
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="omniASR_CTC_300M_v2")
    parser.add_argument("--checkpoint", type=Path, help="Optional downloaded checkpoint; avoids downloading it again")
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--dtype", choices=["float32", "bfloat16"], default="float32")
    args = parser.parse_args()
    if args.threads < 1 or args.repeats < 1:
        parser.error("threads and repeats must be positive")
    import psutil
    proc = psutil.Process()
    started = time.perf_counter()
    stage = "imports"
    peaks = {}
    stop = threading.Event()
    def sample():
        while not stop.is_set():
            try:
                rss = proc.memory_info().rss
                peaks[stage] = max(peaks.get(stage, 0), rss)
            except psutil.Error:
                pass
            stop.wait(0.025)
    watcher = threading.Thread(target=sample, daemon=True)
    watcher.start()
    result = {
        "model": args.model, "device": "cpu", "dtype": args.dtype,
        "threads": args.threads, "repeats": args.repeats,
        "host": {"platform": platform.platform(), "machine": platform.machine(),
                 "logical_cpus": os.cpu_count(), "ram_bytes": psutil.virtual_memory().total},
        "memory_at_start": {"rss_bytes": proc.memory_info().rss,
                            "available_system_bytes": psutil.virtual_memory().available,
                            "swap_used_bytes": psutil.swap_memory().used},
        "runs": [],
    }
    def save():
        result["stage_peak_rss_bytes"] = dict(peaks)
        raw_max = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        result["process_high_water_rss_bytes"] = raw_max if platform.system() == "Darwin" else raw_max * 1024
        result["elapsed_seconds"] = time.perf_counter() - started
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n")
    try:
        print(json.dumps({"stage": stage}), flush=True)
        if args.checkpoint:
            checkpoint = args.checkpoint.resolve(strict=True)
            overrides = args.output.parent.resolve() / "asset-overrides"
            overrides.mkdir(parents=True, exist_ok=True)
            (overrides / "checkpoint.yaml").write_text(
                f"name: leetlogic_local_benchmark\nbase: {args.model}\ncheckpoint: {checkpoint.as_uri()}\n"
            )
            os.environ["FAIRSEQ2_USER_ASSET_DIR"] = str(overrides)
        import torch
        import soundfile as sf
        from omnilingual_asr.models.inference.pipeline import ASRInferencePipeline
        torch.set_num_threads(args.threads)
        torch.set_num_interop_threads(1)
        result["versions"] = {name: importlib.metadata.version(name) for name in
                              ["omnilingual-asr", "fairseq2", "fairseq2n", "torch", "torchaudio", "psutil"]}
        result["import_seconds"] = time.perf_counter() - started
        stage = "model_load"
        print(json.dumps({"stage": stage, "model": args.model}), flush=True)
        load_start = time.perf_counter()
        card_name = args.model
        if args.checkpoint:
            checkpoint = args.checkpoint.resolve(strict=True)
            card_name = "leetlogic_local_benchmark"
            result["checkpoint"] = {"path":str(checkpoint),"bytes":checkpoint.stat().st_size}
        pipeline = ASRInferencePipeline(model_card=card_name, device="cpu", dtype=getattr(torch, args.dtype))
        result["load_seconds_including_any_download"] = time.perf_counter() - load_start
        gc.collect()
        result["loaded_idle_rss_bytes"] = proc.memory_info().rss
        result["parameter_count"] = sum(p.numel() for p in pipeline.model.parameters())
        manifest = json.loads(args.manifest.read_text())
        for item in manifest:
            audio = Path(item["path"])
            if not audio.is_absolute():
                audio = args.manifest.parent / audio
            info = sf.info(audio)
            duration = info.frames / info.samplerate
            if not 0 < duration <= 30:
                raise ValueError(f"Each sample must be 0–30 seconds: {audio}")
            for index in range(args.repeats + 1):
                stage = "first_inference" if index == 0 else "warm_inference"
                print(json.dumps({"stage": stage, "sample": audio.name, "repeat": index}), flush=True)
                begin = time.perf_counter()
                kwargs = {"lang": [item["model_language"]]} if "_LLM_" in args.model else {}
                with torch.inference_mode():
                    text = pipeline.transcribe([str(audio)], batch_size=1, **kwargs)[0]
                seconds = time.perf_counter() - begin
                run = {"sample": audio.name, "language": item.get("language"),
                       "source": item.get("source", "unspecified"), "reference": item.get("reference"),
                       "audio_seconds": duration, "repeat": index, "warm": index > 0,
                       "transcription_seconds": seconds, "real_time_factor": seconds / duration,
                       "transcript": text, "rss_after_bytes": proc.memory_info().rss}
                result["runs"].append(run)
                print(json.dumps(run), flush=True)
                save()
        warm = [r["transcription_seconds"] for r in result["runs"] if r["warm"]]
        result["warm_latency_seconds"] = {"median": statistics.median(warm), "max": max(warm)}
        result["status"] = "complete"
    except Exception as error:
        result["status"] = "failed"
        result["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        stop.set()
        watcher.join(timeout=1)
        result["memory_at_end"] = {"rss_bytes": proc.memory_info().rss,
                                   "available_system_bytes": psutil.virtual_memory().available,
                                   "swap_used_bytes": psutil.swap_memory().used}
        save()

if __name__ == "__main__":
    main()
