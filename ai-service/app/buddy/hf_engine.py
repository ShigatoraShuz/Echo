"""Unmerged local SeaLLMs base with exact CBT and PHQ adapters. No llama.cpp."""
import json
from app.buddy.config import HERE,digest

def make_engine(v3,base,adapter):
 import torch
 from transformers import AutoModelForCausalLM,AutoTokenizer,BitsAndBytesConfig,StoppingCriteria,StoppingCriteriaList
 from peft import PeftModel
 from app.buddy.gpu_memory import require_headroom
 require_headroom(torch,additional_bytes=7*1024**3)
 root=HERE.parents[2]/'models'
 # Root controller verifies the complete bundle too. Verify PHQ in its actual worker.
 manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
 for item in manifest['files']:
  if item['path'].startswith('phq8-seallms/'):
   path=(root/item['path']).resolve()
   if not path.is_relative_to(root.resolve()) or path.stat().st_size!=item['bytes'] or digest(path)!=item['sha256']:raise ValueError('BUDDY_PHQ_ASSET_INTEGRITY_FAILED')
 # Match the existing PHQ NF4 loader, including its non-quantized dtype defaults.
 model=AutoModelForCausalLM.from_pretrained(base,local_files_only=True,trust_remote_code=False,device_map={'':0},
  quantization_config=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.bfloat16))
 model=PeftModel.from_pretrained(model,root/'phq8-seallms/adapter',adapter_name='phq8',local_files_only=True,is_trainable=False)
 model.load_adapter(adapter,adapter_name='cbt',local_files_only=True,is_trainable=False)
 model.eval();model.set_adapter('cbt')
 if any(parameter.device.type!='cuda' or parameter.device.index!=0 for parameter in model.parameters()):
  raise RuntimeError('BUDDY_CBT_GPU_OFFLOAD_MISMATCH')
 engine=v3.LocalCBT.__new__(v3.LocalCBT);engine.torch=torch;engine.device=torch.device('cuda:0');engine.model=model
 engine.tokenizer=AutoTokenizer.from_pretrained(adapter,local_files_only=True,trust_remote_code=False)
 engine.template_state=v3.verify_template(engine.tokenizer)
 if engine.tokenizer.pad_token_id is None:engine.tokenizer.pad_token=engine.tokenizer.eos_token
 engine.eos=v3.stop_ids(engine.tokenizer);engine.StoppingCriteria=StoppingCriteria;engine.StoppingCriteriaList=StoppingCriteriaList
 engine.phq_tokenizer=AutoTokenizer.from_pretrained(root/'phq8-seallms/adapter',local_files_only=True,trust_remote_code=False)
 engine.gguf_identity={'engine':'transformers-peft-shared-nf4-v1','quantization':'NF4','contextTokens':4096}
 require_headroom(torch)
 return engine
