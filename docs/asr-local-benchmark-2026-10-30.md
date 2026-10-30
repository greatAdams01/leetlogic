# Local Meta ASR CPU benchmark — 30 October 2026

Status: **completed**. Both runs loaded the downloaded pretrained checkpoint and returned transcripts. This is a local performance smoke test, not a VPS capacity certification or farmer-language accuracy test.

## Environment

- Apple M1 / arm64 macOS; 8 GiB physical RAM.
- CPU float32, one model process, batch size one; separate processes with two and four Torch threads.
- Model: `omniASR_CTC_300M_v2`; 325,982,896 parameters.
- Checkpoint: 1,304,065,508 bytes; SHA-256 `8ce340ada22435d189908a8af67e3bb04899b6f2f5329d036248b9c3e38d2b50`.
- Meta source pinned at `81f51e224ce9e74b02cc2a3eaf21b2d91d743455` (package reports 0.2.0).
- Torch/torchaudio 2.8.0, fairseq2/fairseq2n 0.6, NumPy 1.26.4, PyArrow 20.0.0.

The initial PyPI ASR 0.1.0 package lacked the v2 architecture. The initial PyArrow 26 wheel could not import with NumPy 1.26.4. Both were corrected in the isolated environment. The soundfile wheel supplies libsndfile through a local library-path override; no global Homebrew installation was required.

## Measurements

Each duration has one first transcription and three warm repeats per thread setting. Figures below are medians of the three warm repeats, excluding HTTP, mobile upload, queueing, spoken prompts and answer validation.

| Audio duration | 2 CPU threads | 4 CPU threads |
|---|---:|---:|
| 3 seconds | 0.348 s | 0.309 s |
| 10 seconds | 1.213 s | 0.819 s |
| 30 seconds | 4.696 s | 4.464 s |

| Memory metric | 2 CPU threads | 4 CPU threads |
|---|---:|---:|
| Process high-water resident memory | 2.079 GiB | 2.209 GiB |
| Resident memory immediately after loading | 0.227 GiB | 0.615 GiB |

**Memory limitation:** model loading uses file-backed weights and the Mac was already under substantial memory pressure/swap use. The low immediately-loaded RSS is not the total model memory requirement. High-water RSS is resident process memory, not total allocated/committed memory, Linux cgroup memory, or a minimum VPS RAM specification. System swap rose during the run; other applications were also running, so that change cannot be attributed solely to ASR. These results do not justify a 2–3 GiB production memory limit.

## Transcription limitations

The fixtures are locally generated English speech repeated/truncated to exact durations. They are useful for speed/memory stress, not accuracy percentages. The 10-second output includes `the price is 15` although the source phrase says one thousand five hundred naira. Other spelling/word errors also occur. Do not automatically accept listing prices or quantities based on these transcripts. Retain explicit confirmation and test realistic, complete per-field answers before enabling the service.

No claims are made for Nigerian English, Pidgin, Igbo, Yoruba or Hausa accuracy from this synthetic performance test. No additional language was enabled and no production listing endpoint was changed.

## Next steps

1. Test complete, natural per-field clips with known expected produce, quantity, price and unit values; then collect consented native-speaker samples for each language.
2. Compare an LLM variant only if this CTC model fails the accuracy threshold. A larger model needs a separate memory/speed benchmark; do not reuse these CTC measurements.
3. Wrap the selected model in one persistent Python worker behind our backend, with bounded uploads and a queue. Include encoding/upload/network/queue time in end-to-end latency.
4. Measure production web/API/PostgreSQL/Redis and ASR together on a Linux x86 VPS. Test one, two and four concurrent requests before purchasing a long-term plan.

## Reproduction and raw evidence

Use [the harness instructions](../scripts/asr/README.md). Raw local JSON, logs and resolved dependencies are under the ignored `.local/asr-benchmark/` directory.

- `.local/asr-benchmark/results/ctc300m-cpu-float32-2threads.json`
- `.local/asr-benchmark/results/ctc300m-cpu-float32-4threads.json`
- `.local/asr-benchmark/requirements-resolved.txt`
- `.local/asr-benchmark/status.json`
