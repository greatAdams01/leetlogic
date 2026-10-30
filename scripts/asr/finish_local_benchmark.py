#!/usr/bin/env python3
"""Finish the already-authorized local benchmark after background downloads complete.

Not a scheduled task: this is a single local run, with progress and errors on disk.
It does not purchase hosting, upload audio, change services or enable production voice.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path(".local/asr-benchmark"))
    parser.add_argument("--wait-hours", type=float, default=6)
    parser.add_argument("--max-rss-gib", type=float, default=4, help="Stop a benchmark exceeding this local process RSS")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    folder = (root / args.directory).resolve()
    python = folder / "venv/bin/python"
    results = folder / "results"
    results.mkdir(exist_ok=True)
    status_file = folder / "status.json"
    checkpoint = folder / "omniASR-CTC-300M-v2.pt"
    started = time.time()
    def status(stage, **details):
        data = {"stage":stage,"updated_unix":time.time(),"elapsed_seconds":time.time()-started,**details}
        temporary = status_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, indent=2)+"\n")
        temporary.replace(status_file)
        print(json.dumps(data),flush=True)
    try:
        deadline = time.monotonic() + args.wait_hours * 3600
        while True:
            install_log = (folder / "install.log").read_text(errors="replace")
            download_log = (folder / "checkpoint-download.log").read_text(errors="replace")
            installed = subprocess.run([str(python),"-c", "import importlib.metadata as m; [m.version(p) for p in ['torch','torchaudio','fairseq2','omnilingual-asr','soundfile','psutil']]"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
            downloaded = checkpoint.with_suffix(".download.json").exists() and checkpoint.stat().st_size == 1304065508
            parts = folder / (checkpoint.name+".parts")
            received = sum(p.stat().st_size for p in parts.glob("*.part"))
            status("waiting_for_downloads",dependencies_installed=installed,checkpoint_complete=downloaded,checkpoint_bytes_received=received,checkpoint_total_bytes=1304065508)
            if installed and downloaded:
                break
            if "error: subprocess-exited-with-error" in install_log or "ResolutionImpossible" in install_log:
                raise RuntimeError("Dependency installation failed. Inspect install.log before retrying.")
            if not downloaded and "Traceback (most recent call last)" in download_log:
                raise RuntimeError("Checkpoint downloader failed. It can resume from saved parts.")
            if time.monotonic() >= deadline:
                raise TimeoutError("Download wait limit reached. Partial downloads are preserved.")
            time.sleep(30)
        env = os.environ.copy()
        env["FAIRSEQ2_CACHE_DIR"] = str(folder / "cache")
        # soundfile's wheel carries libsndfile; expose its actual library to fairseq2n.
        candidates = list((folder / "venv/lib/python3.12/site-packages/_soundfile_data").glob("*.dylib"))
        if candidates and sys.platform == "darwin":
            native = folder / "native-libs"
            native.mkdir(exist_ok=True)
            target = native / "libsndfile.1.dylib"
            if not target.exists():
                target.symlink_to(candidates[0])
            env["DYLD_LIBRARY_PATH"] = str(native)+":"+env.get("DYLD_LIBRARY_PATH", "")
        def run(command, name, timeout):
            with (folder / name).open("w") as log:
                if not name.startswith("benchmark-"):
                    subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=timeout)
                    return
                import psutil
                child = subprocess.Popen(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
                deadline = time.monotonic()+timeout
                observed_peak = 0
                aborted = None
                try:
                    while child.poll() is None:
                        try:
                            memory = psutil.Process(child.pid).memory_info().rss
                            observed_peak = max(observed_peak,memory)
                        except psutil.NoSuchProcess:
                            break
                        if memory > args.max_rss_gib * 1024**3:
                            aborted = f"Stopped to protect the local computer: process RSS exceeded {args.max_rss_gib} GiB"
                            break
                        if time.monotonic() >= deadline:
                            aborted = "Benchmark exceeded its time limit"
                            break
                        time.sleep(0.1)
                    if aborted:
                        child.terminate()
                        try:
                            child.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            child.kill()
                        raise RuntimeError(aborted)
                    code = child.wait()
                    if code:
                        raise subprocess.CalledProcessError(code,command)
                finally:
                    (results / (name+".supervisor.json")).write_text(json.dumps({"observed_peak_rss_bytes":observed_peak,"rss_limit_gib":args.max_rss_gib,"aborted":aborted},indent=2)+"\n")
        status("checking_runtime")
        run([str(python),"-c","import torch, torchaudio, fairseq2, omnilingual_asr; print(torch.__version__)"],"runtime-check.log",120)
        status("preparing_synthetic_audio")
        run([str(python),"scripts/asr/prepare_samples.py","--input",str(folder/"english-short.aiff"),"--output",str(folder/"samples")],"prepare-samples.log",120)
        for threads in [2,4]:
            status("benchmarking",threads=threads)
            run([str(python),"scripts/asr/benchmark.py","--manifest",str(folder/"samples/manifest.json"),"--checkpoint",str(checkpoint),"--output",str(results/f"ctc300m-cpu-float32-{threads}threads.json"),"--threads",str(threads),"--repeats","3"],f"benchmark-{threads}threads.log",1800)
        status("complete",results=str(results))
    except Exception as error:
        status("failed",error_type=type(error).__name__,error=str(error))
        raise

if __name__ == "__main__":
    main()
