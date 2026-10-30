#!/usr/bin/env python3
"""Resumable ranged download for the public Meta CTC 300M-v2 checkpoint.

Every range is checked before joining; partial files stay beside the destination.
No credentials or private audio are sent. The official checkpoint is trusted code/data.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request

URL = "https://dl.fbaipublicfiles.com/mms/omniASR-CTC-300M-v2.pt"
SIZE = 1304065508
CHUNK = 4 * 1024 * 1024


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        parser.error("Use between 1 and 16 workers")
    parts = args.output.parent / (args.output.name + ".parts")
    parts.mkdir(parents=True, exist_ok=True)
    start_time = time.monotonic()
    def get_part(index):
        start = index * CHUNK
        end = min(SIZE, start + CHUNK) - 1
        dest = parts / f"{index:04}.part"
        expected = end - start + 1
        if dest.exists() and dest.stat().st_size == expected:
            return expected
        for attempt in range(8):
            have = dest.stat().st_size if dest.exists() else 0
            if have > expected:
                dest.unlink()
                have = 0
            try:
                req = urllib.request.Request(URL, headers={"Range": f"bytes={start+have}-{end}"})
                with urllib.request.urlopen(req, timeout=120) as response:
                    content_range = response.headers.get("Content-Range", "")
                    if response.status != 206 or content_range != f"bytes {start+have}-{end}/{SIZE}":
                        raise ValueError(f"Server did not honor range: {content_range}")
                    with dest.open("ab") as file:
                        while data := response.read(128 * 1024):
                            file.write(data)
                if dest.stat().st_size == expected:
                    print(json.dumps({"part":index,"bytes":expected,"elapsed_seconds":round(time.monotonic()-start_time,2)}),flush=True)
                    return expected
            except Exception as error:
                print(json.dumps({"part":index,"attempt":attempt+1,"error":str(error)}),flush=True)
                if attempt == 7:
                    raise
                time.sleep(min(2 ** attempt, 30))
        raise RuntimeError(f"Incomplete part {index}")
    total_parts = (SIZE + CHUNK - 1) // CHUNK
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(get_part, range(total_parts)))
    temporary = args.output.with_suffix(args.output.suffix + ".joining")
    digest = hashlib.sha256()
    with temporary.open("wb") as joined:
        for index in range(total_parts):
            with (parts / f"{index:04}.part").open("rb") as part:
                while data := part.read(1024 * 1024):
                    joined.write(data)
                    digest.update(data)
    if temporary.stat().st_size != SIZE:
        raise ValueError("Joined checkpoint size is incorrect")
    os.replace(temporary, args.output)
    metadata={"url":URL,"size_bytes":SIZE,"sha256":digest.hexdigest(),"elapsed_seconds":time.monotonic()-start_time}
    args.output.with_suffix(".download.json").write_text(json.dumps(metadata,indent=2)+"\n")
    print(json.dumps(metadata),flush=True)

if __name__ == "__main__":
    main()
