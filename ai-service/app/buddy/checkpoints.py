"""Verify a local Transformers checkpoint exists before accepting setup."""
import json
from pathlib import Path
def validate_checkpoint(folder):
    folder=Path(folder).resolve()
    def weight(path):
        if not path.is_relative_to(folder) or not path.is_file() or path.stat().st_size<1024:
            raise ValueError('Missing/incomplete model weights: '+str(path))
        with path.open('rb') as stream:
            if stream.read(80).startswith(b'version https://git-lfs.github.com/spec/'):
                raise ValueError('Model contains a Git LFS pointer instead of weights: '+str(path))
    for name in ('model.safetensors','pytorch_model.bin'):
        if (folder/name).is_file():weight(folder/name);return
    for name in ('model.safetensors.index.json','pytorch_model.bin.index.json'):
        if (folder/name).is_file():
            index=json.loads((folder/name).read_text(encoding='utf-8'));files=set(index.get('weight_map',{}).values())
            if not files:raise ValueError('Empty checkpoint index: '+str(folder/name))
            for item in files:weight((folder/item).resolve())
            return
    raise ValueError('No loadable model checkpoint in '+str(folder)+'. Run setup_nano.py --models-only to repair the pinned model downloads.')
