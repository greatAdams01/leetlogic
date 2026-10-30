#!/usr/bin/env python3
"""Make duration-controlled smoke-test inputs from locally generated English speech.

These are synthetic performance fixtures, not evidence of farmer-language accuracy.
Source audio is generated locally with macOS say, never uploaded.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import soundfile as sf

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--input", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
audio, rate = sf.read(args.input, dtype="float32", always_2d=True)
audio = audio.mean(axis=1)
args.output.mkdir(parents=True, exist_ok=True)
rows=[]
for seconds in [3, 10, 30]:
    count = seconds * rate
    repeated = np.tile(audio, int(np.ceil(count / len(audio))))[:count]
    name = f"synthetic-english-{seconds}s.wav"
    sf.write(args.output / name, repeated, rate, subtype="PCM_16")
    rows.append({"path":name,"language":"en","model_language":"eng_Latn",
                 "source":"synthetic-duration-fixture", "duration_seconds":seconds})
(args.output / "manifest.json").write_text(json.dumps(rows,indent=2)+"\n")
print(json.dumps(rows,indent=2))
