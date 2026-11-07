"""Test-only private worker entry; never used by the application launcher."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.buddy import worker
worker.KIND='cbt'
original=worker.cbt

def stress(request):
 if not request.get('stressContext'):return original(request)
 original({'check':True})
 import torch
 from app.buddy.gpu_memory import require_headroom
 engine=worker.ENGINE;engine.model.set_adapter('cbt');engine.model.eval()
 token=engine.tokenizer.encode('school',add_special_tokens=False)[0]
 inputs=torch.full((1,3196),token,dtype=torch.long,device=engine.device)
 with torch.inference_mode():
  generated=engine.model.generate(input_ids=inputs,attention_mask=torch.ones_like(inputs),max_new_tokens=900,min_new_tokens=900,do_sample=False,eos_token_id=engine.eos,pad_token_id=engine.tokenizer.pad_token_id,use_cache=True)
 torch.cuda.empty_cache()
 result={'inputTokens':3196,'generatedTokens':int(generated.shape[1]-3196),'totalTokens':int(generated.shape[1]),'freeGpuBytes':require_headroom(torch)['freeBytes']}
 del generated,inputs
 torch.cuda.empty_cache()
 return result

worker.cbt=stress
if __name__=='__main__':worker.main()
