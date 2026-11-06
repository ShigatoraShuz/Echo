"""Explicit offline unmerged SeaLLMs + two LoRA conversion. Never selects a runtime."""
import argparse,hashlib,importlib.util,json,os,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAME='seallms-shared-q4km'

def helper():
 spec=importlib.util.spec_from_file_location('cbt_setup',ROOT/'scripts/prepare-cbt-gguf.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def inputs(root,h):
 manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
 files=[x for x in manifest['files'] if x['path'].startswith(('buddy/base/','cbt/base/','buddy/adapter/','phq8-seallms/adapter/'))]
 h.verify_files(root,files)
 if h.digest(root/'buddy/adapter/adapter_model.safetensors')!=h.ADAPTER_SHA or h.digest(root/'buddy/adapter/adapter_config.json')!=h.CONFIG_SHA:raise ValueError('Exact mixed_epochs_2 identity differs')
 groups={prefix:{x['path'][len(prefix):]:x['sha256'] for x in files if x['path'].startswith(prefix)} for prefix in ('buddy/base/','cbt/base/')}
 common=set(groups['buddy/base/'])&set(groups['cbt/base/'])
 if not common or not all(groups['buddy/base/'][k]==groups['cbt/base/'][k] for k in common):raise ValueError('Base identities differ')
 if len([k for k in common if k.endswith('.safetensors')])!=4:raise ValueError('Incomplete common base shards')
 for prefix in ('buddy/adapter','phq8-seallms/adapter'):
  c=json.loads((root/prefix/'adapter_config.json').read_text(encoding='utf-8'))
  if c.get('peft_type')!='LORA' or c.get('bias')!='none' or c.get('modules_to_save') or c.get('use_dora'):raise ValueError('Unsupported adapter')
 payload={'base':'SeaLLMs-v3-7B-Chat','files':files}
 payload['identity']=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
 return payload

def validate(path,source,adapter=False,quantized=False):
 sys.path.insert(0,str(source/'gguf-py'))
 from gguf import GGUFReader
 reader=GGUFReader(str(path));types=sorted({x.tensor_type.name for x in reader.tensors})
 if reader.get_field('general.architecture').contents()!='qwen2' or not reader.tensors:raise ValueError('Invalid GGUF architecture/tensors')
 if adapter:
  if reader.get_field('adapter.lora.alpha').contents()!=32:raise ValueError('LoRA alpha differs')
  if reader.get_field('adapter.type').contents()!='lora':raise ValueError('Invalid adapter format')
  names={x.name for x in reader.tensors}
  if len(names)!=392 or any(not x.endswith(('.lora_a','.lora_b')) for x in names):raise ValueError('Unexpected adapter tensor coverage')
  for name in names:
   peer=name[:-7]+('.lora_b' if name.endswith('.lora_a') else '.lora_a')
   if peer not in names:raise ValueError('Missing adapter tensor pair')
 else:
  if len(reader.tensors)!=339 or any('lora' in x.name.lower() for x in reader.tensors):raise ValueError('Base tensor coverage differs')
  if quantized and 'Q4_K' not in types:raise ValueError('Base quantization differs')
 return {'tensorCount':len(reader.tensors),'tensorTypes':types}

def build(root,h,source,runtime,identity):
 target=root/'llama/artifacts'/NAME;stage=target.with_name(NAME+'.staging');stage.mkdir(parents=True,exist_ok=True)
 receipt=stage/'source-identity.json'
 if receipt.exists() and json.loads(receipt.read_text())!=identity:raise ValueError('Staging sources differ')
 h.atomic_json(receipt,identity)
 if shutil.disk_usage(root).free<24*1024**3:raise ValueError('Insufficient conversion staging space')
 env=h.worker_environment()
 outputs=[('base-bf16.gguf',[sys.executable,source/'convert_hf_to_gguf.py',root/'buddy/base','--outtype','bf16','--outfile',stage/'base-bf16.gguf'],False,False),
 ('base-q4_k_m.gguf',[runtime/'bin/llama-quantize.exe',stage/'base-bf16.gguf',stage/'base-q4_k_m.gguf','Q4_K_M','8'],False,True)]
 for label,prefix in [('cbt','buddy/adapter'),('phq','phq8-seallms/adapter')]:
  name=label+'-lora-f32.gguf';outputs.append((name,[sys.executable,source/'convert_lora_to_gguf.py','--base',root/'buddy/base','--outtype','f32','--outfile',stage/name,root/prefix],True,False))
 inventory=[]
 for name,command,is_adapter,quantized in outputs:
  path=stage/name;done=stage/(name+'.verified.json')
  if done.exists():
   record=json.loads(done.read_text());h.verify_files(stage,[record]);print(json.dumps({'stage':'reused','file':name}),flush=True)
  else:
   print(json.dumps({'stage':'converting','file':name}),flush=True)
   h.run(command,env)
   details=validate(path,source,is_adapter,quantized)
   record={'path':name,'bytes':path.stat().st_size,'sha256':h.digest(path)}
   h.atomic_json(done,record);h.atomic_json(stage/(name+'.metadata.json'),details)
  inventory.append(record)
 lock=json.loads((ROOT/'scripts/llama-runtime.lock.json').read_text())
 h.atomic_json(stage/'manifest.json',{'schemaVersion':1,'base':'SeaLLMs-v3-7B-Chat','sourceIdentity':identity,'llamaCommit':lock['commit'],'files':inventory,'resourceLimits':{'memoryBytes':28_000_000_000,'cpuPercent':60},'unmergedBase':True,'activeInferenceChanged':False})
 if target.exists():raise ValueError('Target already exists; do not overwrite activated artifacts')
 os.replace(stage,target)
 print(json.dumps({'stage':'assets_verified','directory':str(target),'activeInferenceChanged':False}),flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--build',action='store_true');parser.add_argument('--limited-worker',action='store_true',help=argparse.SUPPRESS);args=parser.parse_args()
 from windows_resource_limits import run_limited,assert_current_limits
 if not args.limited_worker:raise SystemExit(run_limited([sys.executable,str(Path(__file__).resolve()),*sys.argv[1:],'--limited-worker']))
 assert_current_limits();os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',CUDA_VISIBLE_DEVICES='-1',PYTHONDONTWRITEBYTECODE='1')
 h=helper();root=ROOT/'models';identity=inputs(root,h);lock=json.loads((ROOT/'scripts/llama-runtime.lock.json').read_text());setup=h.setup_module()
 runtime=setup.install(root,lock);source=setup.install_source(root,lock)
 target=root/'llama/artifacts'/NAME
 if (target/'manifest.json').exists():
  m=json.loads((target/'manifest.json').read_text());assert m['sourceIdentity']==identity;h.verify_files(target,m['files']);print(json.dumps({'stage':'existing_verified','activeInferenceChanged':False}),flush=True);return
 print(json.dumps({'stage':'sources_verified','identity':identity['identity'],'buildRequested':args.build}),flush=True)
 if args.build:
  with h.build_lease(root):build(root,h,source,runtime,identity)

if __name__=='__main__':main()
