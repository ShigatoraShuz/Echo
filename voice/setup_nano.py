"""Explicit isolated setup. No existing environment is modified."""
import hashlib,json,os,subprocess,sys,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def setup(models_only=False):
    python=ROOT/'.venv-nano/Scripts/python.exe'
    env=dict(os.environ,PIP_CACHE_DIR=str(ROOT/'cache/pip'),HF_HOME=str(ROOT/'cache/hf'))
    tmp=ROOT/'work/tmp';tmp.mkdir(parents=True,exist_ok=True);env.update(TEMP=str(tmp),TMP=str(tmp))
    if not models_only:
        if not python.exists():subprocess.run([sys.executable,'-m','venv',str(ROOT/'.venv-nano')],check=True,env=env)
        subprocess.run([str(python),'-m','pip','install','torch==2.11.0','torchaudio==2.11.0','--index-url','https://download.pytorch.org/whl/cu130'],check=True,env=env)
        subprocess.run([str(python),'-m','pip','install','transformers==4.57.1','soundfile','sentencepiece','numpy','scipy','torchcodec'],check=True,env=env)
    from huggingface_hub import HfApi,snapshot_download
    manifest_path=ROOT/'setup-manifest.json'
    manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'models':json.loads((ROOT/'models.lock.json').read_text())['revisions'],'files':{},'runtimeRevision':json.loads((ROOT/'models.lock.json').read_text())['runtimeRevision']}
    manifest['status']='repairing model inventory; not ready';manifest_path.write_text(json.dumps(manifest,indent=2))
    for repo,name in [('OpenMOSS-Team/MOSS-TTS-Nano-100M','nano'),('OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano','codec')]:
        revision=manifest['models'].get(repo) or HfApi().model_info(repo).sha;manifest['models'][repo]=revision;manifest_path.write_text(json.dumps(manifest,indent=2))
        snapshot_download(repo,revision=revision,local_dir=ROOT/'models'/name,allow_patterns=['*.json','*.py','*.safetensors','*.bin','*.model','*.txt','*.md','*.jinja'])
        from checkpoints import validate_checkpoint
        validate_checkpoint(ROOT/'models'/name)
    if not (ROOT/'upstream').exists():subprocess.run(['git','clone','https://github.com/OpenMOSS/MOSS-TTS-Nano.git',str(ROOT/'upstream')],check=True,env=env)
    commit=manifest.get('runtimeRevision') or subprocess.check_output(['git','-C',str(ROOT/'upstream'),'rev-parse','HEAD'],text=True).strip()
    manifest['runtimeRevision']=commit;manifest_path.write_text(json.dumps(manifest,indent=2));subprocess.run(['git','-C',str(ROOT/'upstream'),'checkout','--detach',commit],check=True)
    for folder in ('models','upstream'):
        for p in (ROOT/folder).rglob('*'):
            if p.is_file() and '.git' not in p.parts and '.cache' not in p.parts:manifest['files'][str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    manifest['packages']=subprocess.check_output([str(python),'-m','pip','freeze'],text=True).splitlines();manifest['status']='installed; inference verification pending';manifest_path.write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--models-only',action='store_true',help='Repair pinned model downloads without installing packages.')
    setup(parser.parse_args().models_only)
