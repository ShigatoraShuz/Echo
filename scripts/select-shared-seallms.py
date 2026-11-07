"""Explicit offline profile selection. Failed qualification never changes selection."""
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service'))
from app.buddy.shared_seallms import verify_bundle,validation_passed
from app.buddy.config import digest


def atomic_json(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 name=None
 try:
  with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=path.parent,prefix=path.name+'.',suffix='.tmp',delete=False) as stream:
   name=Path(stream.name);json.dump(value,stream,indent=2);stream.flush();os.fsync(stream.fileno())
  os.replace(name,path)
 finally:
  if name is not None and name.exists():name.unlink()


def select(root,profile,report=None):
 destination=Path(root)/'llama/selected-runtime.json'
 if profile=='current':
  atomic_json(destination,{'schemaVersion':1,'profile':'current'})
  return {'profile':'current','restartRequired':True}
 if profile!='shared-seallms' or report is None:raise ValueError('A qualification report is required')
 data=json.loads(Path(report).read_text(encoding='utf-8'))
 lock=json.loads((ROOT/'ai-service/app/buddy/shared-seallms.lock.json').read_text(encoding='utf-8'))
 if not validation_passed(data,lock['manifestSHA256']):raise ValueError('SHARED_VALIDATION_REQUIRED: all required checks must pass for this exact implementation')
 verify_bundle(root)
 # Persist only bounded, allowlisted qualification identity/checks. No logs or prompts.
 approved={key:data[key] for key in ('passed','manifestSHA256','implementationSHA256','checks')}
 target=Path(root)/'llama/shared-validation.json';atomic_json(target,approved)
 atomic_json(destination,{'schemaVersion':1,'profile':profile,'manifestSHA256':lock['manifestSHA256'],'validationSHA256':digest(target)})
 return {'profile':profile,'restartRequired':True}


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=('current','shared-seallms'),required=True);parser.add_argument('--report',type=Path);args=parser.parse_args()
 print(json.dumps(select(ROOT/'models',args.profile,args.report)))

if __name__=='__main__':main()
