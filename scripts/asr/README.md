# Local Meta ASR measurement

This harness measures a **real pretrained checkpoint** on CPU. It is not connected to production listing flows. No input audio is uploaded. The initial checkpoint downloads from Meta's published URL; the download is approximately 1.21 GiB.

## What is measured

- Python/runtime imports, model initialization (including any asset downloads), loaded idle RSS.
- Process high-water RSS and sampled stage peaks every 25 ms. RSS is physical resident process memory, not model disk size or Linux container memory.
- First transcription and three subsequent transcriptions for each 3-, 10- and 30-second synthetic clip.
- CPU float32, batch size one, separate fresh processes with two and four Torch threads.
- Transcript output and exact package versions. Synthetic clips measure performance only; repeated/truncated speech does not establish accuracy.

The operating system may cache model files after the first process. 'First inference' means first for that clip in that process, not a verified cold-machine result. System swap is recorded at the start and end; unrelated apps can affect this value. There is no memory-allocation or CPU-performance equivalence between the Apple M1 host and a Namecheap x86 VPS.

## Files

Everything downloaded/generated lives in the ignored `.local/asr-benchmark/` directory:

- `venv/`: isolated Python 3.12 environment.
- `install.log`: actual dependency installation output.
- `omniASR-CTC-300M-v2.pt.parts/`: resumable checkpoint chunks.
- `checkpoint-download.log`: transfer progress and retry errors.
- `status.json`: stage of the single local benchmark run.
- `results/*.json`: measurements, written only by the inference process.
- `benchmark-2threads.log`, `benchmark-4threads.log`: actual transcripts and runtime output.

Do not interpret `status.json: complete` as a production accuracy or VPS-capacity certification.

## Reproduce

Use Python 3.12. Create an isolated environment and install `requirements.txt`. Meta's `fairseq2n` binary must match the pinned Torch version; Linux builds need the matching CPU wheel and system libsndfile. The default macOS CPU run deliberately uses float32 rather than GPU-only reference figures.

```sh
python3.12 -m venv .local/asr-benchmark/venv
.local/asr-benchmark/venv/bin/python -m pip install -r scripts/asr/requirements.txt
.local/asr-benchmark/venv/bin/python scripts/asr/download_checkpoint.py \
  --output .local/asr-benchmark/omniASR-CTC-300M-v2.pt
```

Create local English speech with macOS `say`, or supply your own WAV/FLAC input. There is no recording/upload requirement for a performance smoke test.

```sh
say -v Daniel -r 145 -o .local/asr-benchmark/english-short.aiff \
  'I have twenty five kilograms of fresh tomatoes. The price is one thousand five hundred naira per kilogram.'
.local/asr-benchmark/venv/bin/python scripts/asr/prepare_samples.py \
  --input .local/asr-benchmark/english-short.aiff \
  --output .local/asr-benchmark/samples
.local/asr-benchmark/venv/bin/python scripts/asr/benchmark.py \
  --manifest .local/asr-benchmark/samples/manifest.json \
  --checkpoint .local/asr-benchmark/omniASR-CTC-300M-v2.pt \
  --output .local/asr-benchmark/results/ctc300m.json
```

`finish_local_benchmark.py` waits for the current installer/download to finish, checks the runtime, prepares fixtures and runs both thread settings. It stops and records the failure if dependencies, native libraries or inference fail. Its default 4 GiB process-RSS guard protects the 8 GB local computer; a guard stop is a failed/limited run, not a measured model capacity requirement. It is a one-off local process, not an automation or a hosted service.

## Sizing decisions after measurements

1. Confirm exact checkpoint and successful transcripts; report idle and peak RSS, initialization time, per-duration warm median/max latency, and swap changes.
2. Use a real farmer-language test set for English, Pidgin, Igbo, Yoruba and Hausa. Measure exact quantity/price/unit accuracy, not just readable prose. CTC has no selected-language conditioning; evaluate an LLM variant separately if necessary.
3. Build production website/API processes and measure them with PostgreSQL and Redis running. Development-server memory does not size production.
4. On a monthly/trial x86 VPS, rerun the same checkpoint and clips with Linux container memory metrics, then repeat while browsing, authenticating and creating sandbox orders. Do not make live purchases or payment requests for a capacity test.
5. Test one, two and four simultaneous transcription requests with a bounded queue; record queue-inclusive latency and API latency. Multiple Python worker processes each load another model copy.
6. Select and enforce container memory/CPU budgets from those measurements, reserve headroom for PostgreSQL/OS/queue buffers, then repeat under the proposed limits. Do not choose a long-term VPS plan from model parameter count, GPU VRAM figures or the M1 benchmark alone.

Sources: [Meta inference guide](https://github.com/facebookresearch/omnilingual-asr/blob/main/src/omnilingual_asr/models/inference/README.md), [model cards](https://github.com/facebookresearch/omnilingual-asr/blob/main/src/omnilingual_asr/cards/models/rc_models_v2.yaml), [fairseq2 installation](https://github.com/facebookresearch/fairseq2#installation).
