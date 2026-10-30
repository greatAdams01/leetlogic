#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
.local/asr-benchmark/venv/bin/python - <<'PY'
import os,secrets
from pathlib import Path
folder=Path('.local/asr-benchmark')
env=folder/'service.env'
if not env.exists():
    token=secrets.token_urlsafe(32)
    fd=os.open(env,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as file:
        file.write(f'LISTING_ASR_ENABLED=true\nLISTING_ASR_URL=http://127.0.0.1:8091\nLISTING_ASR_TOKEN={token}\n')
native=folder/'native-libs'
native.mkdir(exist_ok=True)
lib=native/'libsndfile.1.dylib'
source=next((folder/'venv/lib').glob('python*/site-packages/_soundfile_data/*.dylib'),None)
if source and not lib.exists(): lib.symlink_to(source.resolve())
PY
set -a
source .local/asr-benchmark/service.env
set +a
export DYLD_LIBRARY_PATH="$PWD/.local/asr-benchmark/native-libs${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
exec .local/asr-benchmark/venv/bin/python scripts/asr/service.py --checkpoint .local/asr-benchmark/omniASR-CTC-300M-v2.pt --threads 2
