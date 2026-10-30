"""RoBERTa-large shared backbone, primary Plutchik-8 CE, auxiliary GoEmotions-27 BCE.

Pure torch training loop; compatible with Transformers 4.5x / 5.5 tokenization APIs.
"""
import json
from pathlib import Path
from .config import BASE_MODEL,PLUTCHIK,GO_LABELS

def instantiate(base=BASE_MODEL):
 import torch
 from transformers import AutoModel
 class E4Net(torch.nn.Module):
  def __init__(self):
   super().__init__()
   self.encoder=AutoModel.from_pretrained(str(base))
   hidden=self.encoder.config.hidden_size
   self.dropout=torch.nn.Dropout(0.15)
   self.plutchik=torch.nn.Linear(hidden,8)
   self.goemotions=torch.nn.Linear(hidden,27)
  def forward(self,input_ids,attention_mask,task='primary'):
   emb=self.encoder(input_ids=input_ids,attention_mask=attention_mask,return_dict=True).last_hidden_state[:,0]
   emb=self.dropout(emb)
   if task=='primary':return self.plutchik(emb)
   if task=='go':return self.goemotions(emb)
   raise ValueError('Unknown task')
 return E4Net()

def save_model(model,tokenizer,target,metadata):
 import torch
 p=Path(target);p.mkdir(parents=True,exist_ok=False)
 model.encoder.save_pretrained(p/'encoder',safe_serialization=True)
 torch.save({'plutchik':model.plutchik.state_dict(),
             'goemotions':model.goemotions.state_dict()},p/'heads.pt')
 tokenizer.save_pretrained(p)
 (p/'e4_config.json').write_text(json.dumps({**metadata,'plutchik_labels':PLUTCHIK,
  'goemotions_labels':GO_LABELS,'encoder_dir':'encoder','heads_file':'heads.pt'},indent=2),encoding='utf8')

def load_model(path,device=None):
 import torch
 from transformers import AutoTokenizer
 p=Path(path)
 if not (p/'e4_config.json').exists():raise FileNotFoundError(f'Missing e4_config.json: {p}')
 metadata=json.loads((p/'e4_config.json').read_text(encoding='utf8'))
 if metadata.get('plutchik_labels')!=PLUTCHIK or metadata.get('goemotions_labels')!=GO_LABELS:
  raise RuntimeError('Label order mismatch in checkpoint')
 model=instantiate(p/'encoder')
 states=torch.load(p/'heads.pt',map_location='cpu',weights_only=True)
 model.plutchik.load_state_dict(states['plutchik'])
 model.goemotions.load_state_dict(states['goemotions'])
 tokenizer=AutoTokenizer.from_pretrained(p,use_fast=True)
 device=torch.device(device or ('cuda' if torch.cuda.is_available() else 'cpu'))
 model.to(device).eval()
 return model,tokenizer,metadata,device
