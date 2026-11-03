"""Explicit offline asset copy; original assets are never changed."""
import argparse,hashlib,json,os,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(8*1024**2),b''):h.update(b)
 return h.hexdigest()
def main():
 shared=ROOT.parent/'models';nano=ROOT.parent/'TTS_INFERENCE_NANO_PRELOAD'
 adapter=Path('E:/Python Project/PROJECTS/Thesis2/CBT_RESPONSE/CBT_BASE_MODEL/outputs/quality_tuning/mixed_epochs_2/final_adapter')
 base=Path(json.loads((adapter/'adapter_config.json').read_text())['base_model_name_or_path'])
 sources=[(shared/x,x) for x in ['cbt','e4-c','xlmr-v2','phq8-seallms','face_model','voice/whisper']]
 sources += [(adapter,'buddy/adapter'),(base,'buddy/base'),(nano/'models/nano','buddy/models/nano'),(nano/'models/codec','buddy/models/codec'),(nano/'voices/buddy','buddy/voices/buddy')]
 items=[]
 for source,dest in sources:
  if not source.is_dir():raise RuntimeError('Required source absent: '+str(source))
  for f in source.rglob('*'):
   if not f.is_file() or any(x in ('__pycache__','.git','.cache') for x in f.relative_to(source).parts) or f.suffix in ('.pyc','.tmp','.log'):continue
   items.append((f,Path(dest)/f.relative_to(source)))
 stage=ROOT/'models.staging';target=ROOT/'models';stage.mkdir(exist_ok=True)
 if target.exists():raise RuntimeError('Existing models preserved. Verify before replacing.')
 total=sum(f.stat().st_size for f,_ in items)
 print(json.dumps({'files':len(items),'bytes':total,'freeBytes':shutil.disk_usage(ROOT).free}),flush=True)
 remaining=sum(f.stat().st_size for f,p in items if not (stage/p).exists())
 if shutil.disk_usage(ROOT).free<remaining+2*1024**3:raise RuntimeError('Insufficient staging capacity')
 inventory=[]
 for i,(f,p) in enumerate(items):
  expected=sha(f);out=stage/p;out.parent.mkdir(parents=True,exist_ok=True)
  if not out.exists() or out.stat().st_size!=f.stat().st_size or sha(out)!=expected:
   temp=out.with_name(out.name+'.copying');shutil.copy2(f,temp)
   if sha(temp)!=expected:raise RuntimeError('Copy checksum failed')
   os.replace(temp,out)
  inventory.append({'path':p.as_posix(),'bytes':f.stat().st_size,'sha256':expected})
  if i%20==0:print('Verified '+str(i+1)+'/'+str(len(items)),flush=True)
 manifest=json.loads((shared/'manifest.json').read_text());manifest['files']=[x for x in manifest['files'] if '.cache' not in Path(x['path']).parts];
 for entry in manifest['files']:
  if entry['path'] in ('cbt/adapter/adapter_config.json','cbt/adapter/adapter_model.safetensors'):
   selected=stage/'buddy/adapter'/Path(entry['path']).name
   if sha(stage/entry['path'])!=sha(selected):raise RuntimeError('Core/Buddy adapter mismatch')
   entry.update(sha256=sha(selected),bytes=selected.stat().st_size)
 (stage/'manifest.json').write_text(json.dumps(manifest,indent=2))
 (stage/'bundle.manifest.json').write_text(json.dumps({'schemaVersion':1,'files':inventory},indent=2))
 os.replace(stage,target)
 print('Bundle activated',flush=True)
if __name__=='__main__':main()
