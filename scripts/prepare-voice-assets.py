"""Copy approved base voice assets only; never reads reference voices."""
from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[2]
source=root.parent/'PROJECTS/Thesis2/TESTING VOICE/Models'
paths={'whisper':source/'Whisper/models--mobiuslabsgmbh--faster-whisper-large-v3-turbo/snapshots/0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf','moss':source/'HuggingFace/hub/models--OpenMOSS-Team--MOSS-TTS-Local-Transformer-v1.5/snapshots/be7766a6735b98bd793f7c79fb720b4d0f5d13b8','audio-tokenizer':source/'HuggingFace/hub/models--OpenMOSS-Team--MOSS-Audio-Tokenizer-v2/snapshots/f6e20e543b33d2c252a7ef71bdf8aa71e5ff9169'}
manifest=[]
for name,path in paths.items():
 for f in path.iterdir():
  if not f.is_file():continue
  d=root/'models/voice'/name/f.name;d.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,d)
  def digest(p):
   h=hashlib.sha256()
   with p.open('rb') as stream:
    for b in iter(lambda:stream.read(8388608),b''):h.update(b)
   return h.hexdigest()
  sha=digest(f)
  if digest(d)!=sha:raise ValueError('Copy mismatch')
  manifest.append(dict(path=str(d.relative_to(root/'models')),source=str(f),sha256=sha,size=d.stat().st_size,revision=path.name))
(root/'models/voice/manifest.json').write_text(json.dumps(manifest,indent=2))
print('Verified voice assets',len(manifest))
