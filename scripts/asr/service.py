#!/usr/bin/env python3
"""Local/private Meta ASR HTTP worker. Load one model; never log or persist audio.

Phone -> authenticated LeetLogic API -> this loopback service. English test only.
"""
import argparse
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import threading
import time

MAX_BYTES = 2 * 1024 * 1024


def decode_audio(data, ffmpeg):
    import numpy as np
    command = [ffmpeg,"-nostdin","-hide_banner","-loglevel","error","-protocol_whitelist","pipe",
               "-i","pipe:0","-vn","-sn","-dn","-t","31","-ac","1","-ar","16000","-f","f32le","pipe:1"]
    decoded = subprocess.run(command,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15,check=True).stdout
    wave = np.frombuffer(decoded,dtype="<f4").copy()
    duration = len(wave)/16000
    if not 0.15 <= duration <= 30.1 or not np.isfinite(wave).all():
        raise ValueError("Record between one and thirty seconds of speech")
    if float(np.max(np.abs(wave))) < 0.0001:
        raise ValueError("No speech was heard")
    return wave,duration


def handler_for(pipeline,ffmpeg,token):
    lock=threading.Lock()
    slots=threading.BoundedSemaphore(4)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):
            pass  # No tokens, transcripts, request bodies or audio in logs.
        def send_json(self,status,body):
            payload=json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type","application/json")
            self.send_header("Cache-Control","no-store")
            self.send_header("Content-Length",str(len(payload)))
            self.end_headers()
            try: self.wfile.write(payload)
            except (BrokenPipeError,ConnectionResetError): pass
        def do_GET(self):
            if self.path == "/health":
                self.send_json(200,{"status":"ready","provider":"meta","model":"omniASR_CTC_300M_v2","languages":["en"],"maxAudioSeconds":30})
            else: self.send_json(404,{"error":"NOT_FOUND"})
        def do_POST(self):
            self.connection.settimeout(20)
            if self.path != "/transcribe?language=en":
                self.send_json(422,{"error":"UNSUPPORTED_LANGUAGE"});return
            if not hmac.compare_digest(self.headers.get("Authorization",""),f"Bearer {token}"):
                self.send_json(401,{"error":"UNAUTHORIZED"});self.close_connection=True;return
            try: size=int(self.headers.get("Content-Length","0"))
            except ValueError: size=0
            if not 16 <= size <= MAX_BYTES or self.headers.get("Transfer-Encoding"):
                self.send_json(413,{"error":"AUDIO_SIZE_LIMIT"});self.close_connection=True;return
            if not slots.acquire(blocking=False):
                self.send_json(503,{"error":"ASR_BUSY"});self.close_connection=True;return
            acquired=False
            try:
                if not lock.acquire(blocking=False):
                    self.send_json(503,{"error":"ASR_BUSY"});self.close_connection=True;return
                acquired=True
                raw=self.rfile.read(size)
                if len(raw)!=size: raise ValueError("Incomplete audio upload")
                started=time.monotonic()
                wave,duration=decode_audio(raw,ffmpeg)
                del raw
                import torch
                with torch.inference_mode():
                    text=pipeline.transcribe([{"waveform":wave,"sample_rate":16000}],batch_size=1)[0].strip()
                if not text or len(text)>5000: raise ValueError("No clear answer was heard")
                self.send_json(200,{"text":text,"language":"en","audioSeconds":duration,"processingSeconds":time.monotonic()-started})
            except (ValueError,subprocess.SubprocessError):
                self.send_json(422,{"error":"INVALID_AUDIO"})
            except Exception:
                self.send_json(503,{"error":"ASR_UNAVAILABLE"})
            finally:
                if acquired: lock.release()
                slots.release()
    return Handler


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint",type=Path,required=True)
    parser.add_argument("--port",type=int,default=8091)
    parser.add_argument("--threads",type=int,default=2)
    args=parser.parse_args()
    token=os.environ.get("LISTING_ASR_TOKEN","")
    if len(token)<24: parser.error("Set LISTING_ASR_TOKEN to a private token of at least 24 characters")
    checkpoint=args.checkpoint.resolve(strict=True)
    folder=checkpoint.parent
    assets=folder/"service-assets"
    assets.mkdir(exist_ok=True)
    (assets/"local.yaml").write_text(f"name: leetlogic_service_ctc300m\nbase: omniASR_CTC_300M_v2\ncheckpoint: {checkpoint.as_uri()}\n")
    os.environ["FAIRSEQ2_USER_ASSET_DIR"]=str(assets)
    os.environ.setdefault("FAIRSEQ2_CACHE_DIR",str(folder/"cache"))
    import torch
    import imageio_ffmpeg
    from omnilingual_asr.models.inference.pipeline import ASRInferencePipeline
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    print("Loading Meta CTC 300M v2 on CPU...",flush=True)
    pipeline=ASRInferencePipeline(model_card="leetlogic_service_ctc300m",device="cpu",dtype=torch.float32)
    server=ThreadingHTTPServer(("127.0.0.1",args.port),handler_for(pipeline,imageio_ffmpeg.get_ffmpeg_exe(),token))
    server.daemon_threads=True
    print(f"ASR ready: http://127.0.0.1:{args.port}/health (English test mode)",flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__": main()
