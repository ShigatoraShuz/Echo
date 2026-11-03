"""Runs only in Thesis2_VENV; source V3 remains unchanged."""
import contextlib,hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
from runtime_config import CBT_ADAPTER as ADAPTER
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
ENGINE=None
PROVENANCE=None
def run(request):
    global ENGINE,PROVENANCE
    if ENGINE is not None:
        if request.get('check'):return PROVENANCE
        result=ENGINE.reply(request['messages']);result['modelIdentity']=PROVENANCE;return result
    sys.path.insert(0,str(ROOT/'cbt_vendor'))
    import echo_cbt_standalone as v3
    import torch,peft,bitsandbytes
    base=Path(os.environ.get('BUDDY_CBT_BASE') or json.loads((ADAPTER/'adapter_config.json').read_text())['base_model_name_or_path'])
    original=v3.policy
    def policy():
        p=original();p['manifestEntries']=[x for x in p['manifestEntries'] if not x['path'].replace('\\','/').startswith('cbt/adapter/')];return p
    v3.policy=policy
    v3.preflight(base,ADAPTER,check_hashes=True)
    provenance={'model':'SeaLLMs-v3-7B-Chat + mixed_epochs_2','adapterSHA256':hashlib.sha256((ADAPTER/'adapter_model.safetensors').read_bytes()).hexdigest(),'inferencePolicy':v3.VERSION}
    if not torch.cuda.is_available():raise RuntimeError('CBT requires CUDA.')
    ENGINE=v3.LocalCBT(base,ADAPTER);PROVENANCE=provenance
    if request.get('check'):
        from transformers import AutoTokenizer
        tokenizer=AutoTokenizer.from_pretrained(str(ADAPTER),local_files_only=True,trust_remote_code=False)
        provenance['templateCheck']=v3.verify_template(tokenizer)
        return provenance
    result=ENGINE.reply(request['messages']);result['modelIdentity']=provenance
    return result
