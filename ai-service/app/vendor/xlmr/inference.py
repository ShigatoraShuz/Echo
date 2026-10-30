"""Model loading and long-journal token-window helpers."""
import torch  # import first on Windows to avoid some c10.dll initialization conflicts
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from .core import LABELS


def load_checkpoint(directory):
    tokenizer = AutoTokenizer.from_pretrained(str(directory),use_fast=True)
    model = AutoModelForSequenceClassification.from_pretrained(str(directory))
    if getattr(model.config, 'model_type', None) != 'xlm-roberta':
        raise ValueError(f'Checkpoint is not XLM-RoBERTa (got {model.config.model_type!r}).')
    if int(model.config.num_labels)!=len(LABELS):
        raise ValueError('Not a five-class XLM-RoBERTa model; verify checkpoint directory')
    if [model.config.id2label[i] for i in range(5)]!=list(LABELS):
        raise ValueError('Incorrect checkpoint id2label mapping')
    device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device).eval()
    return model,tokenizer,device


@torch.inference_mode()
def batch_logits(model,tokenizer,device,texts,max_length=256,batch_size=16):
    out=[]
    for start in range(0,len(texts),batch_size):
        encoded=tokenizer(list(texts[start:start+batch_size]),padding=True,truncation=True,
                          max_length=max_length,return_tensors='pt')
        encoded={k:v.to(device) for k,v in encoded.items()}
        out.append(model(**encoded).logits.float().cpu().numpy())
    return np.concatenate(out,axis=0) if out else np.empty((0,5),dtype='float32')


@torch.inference_mode()
def window_logits(model,tokenizer,device,text,max_length=256,stride=64,batch_size=16):
    if not text or not text.strip():
        raise ValueError('Empty journal')
    if not 0 <= stride < max_length-tokenizer.num_special_tokens_to_add(pair=False):
        raise ValueError('Invalid stride')
    original_tokens=len(tokenizer(text,add_special_tokens=True,truncation=False)['input_ids'])
    blocks=tokenizer(text,truncation=True,max_length=max_length,stride=stride,
                     return_overflowing_tokens=True,padding=False)
    outputs=[]
    for i in range(0,len(blocks['input_ids']),batch_size):
        rows={k:v[i:i+batch_size] for k,v in blocks.items() if k in ('input_ids','attention_mask','token_type_ids')}
        padded=tokenizer.pad(rows,padding=True,return_tensors='pt')
        padded={k:v.to(device) for k,v in padded.items()}
        outputs.append(model(**padded).logits.float().cpu().numpy())
    return np.concatenate(outputs,axis=0),original_tokens
