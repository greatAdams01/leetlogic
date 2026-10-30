"""Send synthetic WAV and phone-format M4A to the local authenticated worker."""
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request
import imageio_ffmpeg

folder=Path('.local/asr-benchmark')
values=dict(line.split('=',1) for line in (folder/'service.env').read_text().splitlines() if '=' in line)
url=values['LISTING_ASR_URL']
print(json.load(urllib.request.urlopen(url+'/health',timeout=10)))
source=folder/'samples/synthetic-english-3s.wav'
with tempfile.TemporaryDirectory() as temporary:
    m4a=Path(temporary)/'phone.m4a'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-i',str(source),'-c:a','aac',str(m4a)],check=True)
    for file,mime in [(source,'audio/wav'),(m4a,'audio/mp4')]:
        request=urllib.request.Request(url+'/transcribe?language=en',data=file.read_bytes(),headers={'Content-Type':mime,'Authorization':'Bearer '+values['LISTING_ASR_TOKEN']})
        result=json.load(urllib.request.urlopen(request,timeout=45))
        print(json.dumps({'format':mime,**result}))
