"""Explicit setup only. Never invoked by application inference/startup."""
import argparse,hashlib,json,os,shutil,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as stream:
  for chunk in iter(lambda:stream.read(8*1024**2),b''):h.update(chunk)
 return h.hexdigest()

def verify(path,expected):
 if digest(path)!=expected:raise ValueError('Artifact checksum mismatch: '+Path(path).name)

def extract(archive,destination):
 destination=Path(destination).resolve()
 with zipfile.ZipFile(archive) as z:
  for item in z.infolist():
   name=item.filename.replace('\\','/')
   target=(destination/name).resolve()
   if not target.is_relative_to(destination) or ':' in name or (item.external_attr>>16)&0o170000==0o120000:raise ValueError('Unsafe archive member')
  z.extractall(destination)

def install(root,lock,download=False):
 target=Path(root)/'llama/runtime'/lock['tag'];stage=target.with_name(target.name+'.staging')
 if (target/'manifest.json').exists():
  manifest=json.loads((target/'manifest.json').read_text(encoding='utf-8'))
  if manifest['commit']!=lock['commit'] or manifest.get('assets')!=lock['assets']:raise ValueError('Existing runtime revision differs')
  for item in manifest['files']:
   path=(target/item['path']).resolve()
   if not path.is_relative_to(target.resolve()):raise ValueError('Unsafe manifest path')
   if path.stat().st_size!=item['bytes']:raise ValueError('Installed runtime size differs')
   verify(path,item['sha256'])
  return target
 if not download:raise ValueError('Explicit --download is required for setup')
 if target.exists():raise ValueError('Unverified target exists; preserve it for review')
 if shutil.disk_usage(Path(root)).free<4*1024**3:raise ValueError('Insufficient runtime staging space')
 stage.mkdir(parents=True,exist_ok=True)
 for asset in lock['assets']:
  archive=stage/asset['name']
  if not archive.exists():
   url=lock['repository']+'/releases/download/'+lock['tag']+'/'+asset['name']
   temporary=archive.with_suffix('.downloading')
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Echo-explicit-local-setup'}),timeout=120) as response,temporary.open('wb') as output:shutil.copyfileobj(response,output)
   verify(temporary,asset['sha256']);os.replace(temporary,archive)
  verify(archive,asset['sha256']);extract(archive,stage/'bin')
 files=[{'path':p.relative_to(stage).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)} for p in (stage/'bin').rglob('*') if p.is_file()]
 if not any(Path(item['path']).name=='llama-server.exe' for item in files):raise ValueError('llama-server executable absent')
 (stage/'manifest.json').write_text(json.dumps({'schemaVersion':1,'tag':lock['tag'],'commit':lock['commit'],'assets':lock['assets'],'files':files},indent=2),encoding='utf-8')
 os.replace(stage,target)
 return target

def install_source(root,lock,download=False):
 """Stage the exact converter source; never execute downloaded code here."""
 commit=lock['commit']
 if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):
  raise ValueError('Invalid source commit')
 expected=lock.get('sourceArchiveSHA256')
 if not expected or len(expected)!=64:raise ValueError('Pinned source checksum is required')
 target=Path(root)/'llama/converter'/commit
 archive=Path(root)/'llama'/(commit+'.source.zip')
 if not archive.exists():
  if not download:raise ValueError('Explicit --download is required for source setup')
  archive.parent.mkdir(parents=True,exist_ok=True)
  temporary=archive.with_suffix('.downloading')
  url='https://codeload.github.com/ggml-org/llama.cpp/zip/'+commit
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Echo-explicit-local-setup'}),timeout=120) as response,temporary.open('wb') as output:shutil.copyfileobj(response,output)
  verify(temporary,expected);os.replace(temporary,archive)
 verify(archive,expected)
 prefix='llama.cpp-'+commit+'/'
 # Verify extracted files against the trusted archive rather than trusting a local inventory.
 if (target/'manifest.json').exists():
  manifest=json.loads((target/'manifest.json').read_text(encoding='utf-8'))
  if manifest.get('commit')!=commit or manifest.get('sourceArchiveSHA256')!=expected:raise ValueError('Source revision differs')
  with zipfile.ZipFile(archive) as z:
   expected_files={'manifest.json'}
   for item in z.infolist():
    if item.is_dir():continue
    if not item.filename.startswith(prefix):raise ValueError('Unexpected source archive root')
    relative=item.filename[len(prefix):]
    expected_files.add(relative)
    path=(target/relative).resolve()
    if not path.is_relative_to(target.resolve()):raise ValueError('Unsafe source path')
    if not path.is_file() or path.stat().st_size!=item.file_size:raise ValueError('Installed source differs')
    with z.open(item) as stream:
     h=hashlib.sha256()
     for chunk in iter(lambda:stream.read(8*1024**2),b''):h.update(chunk)
    verify(path,h.hexdigest())
   actual_files={p.relative_to(target).as_posix() for p in target.rglob('*') if p.is_file()}
   if actual_files!=expected_files:raise ValueError('Unexpected installed source files')
  return target
 if not download:raise ValueError('Explicit --download is required for source activation')
 if target.exists():raise ValueError('Unverified source target exists; preserve it for review')
 stage=target.with_name(commit+'.staging');stage.mkdir(parents=True,exist_ok=True)
 extract(archive,stage)
 source=stage/prefix.rstrip('/')
 for required in ('convert_hf_to_gguf.py','LICENSE','gguf-py/gguf/__init__.py'):
  if not (source/required).is_file():raise ValueError('Required converter asset absent: '+required)
 (source/'manifest.json').write_text(json.dumps({'schemaVersion':1,'commit':commit,'sourceArchiveSHA256':expected},indent=2),encoding='utf-8')
 os.replace(source,target)
 # Only remove the now-empty, application-owned staging directory.
 stage.rmdir()
 return target

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');parser.add_argument('--source',action='store_true');args=parser.parse_args()
 lock=json.loads((ROOT/'scripts/llama-runtime.lock.json').read_text(encoding='utf-8'))
 print((install_source if args.source else install)(ROOT/'models',lock,args.download))
