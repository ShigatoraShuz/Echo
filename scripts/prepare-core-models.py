"""Copy only inference artifacts; never alter the research checkpoints."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT.parent / 'models'
THESIS = Path('E:/Python Project/PROJECTS/Thesis2')
X = THESIS / 'MENTAL DISTRESS/Echo_XLMR_5Class_Audited_Training_Pipeline_V2_READY'
E = THESIS / 'EMOTION_DETECTION/Echo_E4_RoBERTaLarge_All27_GoEmotions_Multitask_FULL/Echo_E4_Full27_GoEmotions_Multitask'
C = THESIS / 'CBT_RESPONSE/CBT_BASE_MODEL'
V = THESIS / 'CBT_RESPONSE/ECHO_CBT_MixedLR1e4_Conversational_Fix_V41'

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(8 * 1024 * 1024), b''): h.update(block)
    return h.hexdigest()

def main():
    entries = []
    sources = [('xlmr-v2/best_model', X/'artifacts/xlmr_v2_len384/best_model'),
               ('xlmr-v2/calibration', X/'artifacts/xlmr_v2_len384/calibration'),
               ('e4-c', E/'runs/E4_C_fresh_roberta_large_seed42/best_model'),
               ('cbt/base', C/'assets/models/SeaLLMs-v3-7B-Chat'),
               ('cbt/adapter', C/'outputs/quality_tuning/mixed_lr_1e4/final_adapter')]
    allowed = {'.json', '.safetensors', '.bin', '.model', '.txt', '.pt', '.tiktoken', '.jinja', '.vocab', '.merges'}
    for relative, source in sources:
        for original in sorted(source.rglob('*')):
            if not original.is_file() or original.suffix not in allowed: continue
            if original.name in {'training_args.bin', 'optimizer.pt', 'scheduler.pt', 'rng_state.pth'}: continue
            if original.suffix == '.pt' and original.name != 'heads.pt': continue
            if relative.endswith('calibration') and original.name != 'calibration.json': continue
            target = DEST/relative/original.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            checksum = digest(original)
            if not target.exists() or digest(target) != checksum: shutil.copyfile(original, target)
            if digest(target) != checksum: raise RuntimeError(f'Copy verification failed: {target}')
            entries.append({'path':target.relative_to(DEST).as_posix(),'source':str(original),'bytes':target.stat().st_size,'sha256':checksum})
    original=X/'artifacts/xlmr_v2_len384/training_manifest.json'; target=DEST/'xlmr-v2/training_manifest.json'
    shutil.copyfile(original,target)
    entries.append({'path':target.relative_to(DEST).as_posix(),'source':str(original),'bytes':target.stat().st_size,'sha256':digest(target)})
    vendor = ROOT/'ai-service/app/vendor'
    for name in ['xlmr','e4','cbt']:
        (vendor/name).mkdir(parents=True,exist_ok=True);(vendor/name/'__init__.py').touch()
    (vendor/'__init__.py').touch()
    for name in ['core.py','inference.py']:
        shutil.copyfile(X/'echo_xlmr_distress'/name,vendor/'xlmr'/name)
    text=(X/'05_infer_journal.py').read_text(encoding='utf-8').replace('from echo_xlmr_distress.', 'from .')
    (vendor/'xlmr/classifier.py').write_text(text,encoding='utf-8')
    for source,name in [('config.py','config.py'),('e4_model.py','model.py'),('09_INFER_E4C_JOURNAL.py','inference.py')]:
        text=(E/source).read_text(encoding='utf-8').replace('from config import','from .config import')
        (vendor/'e4'/name).write_text(text,encoding='utf-8')
    for name in ['echo_inference.py','echo_v41.py']:
        text=(V/name).read_text(encoding='utf-8').replace('import echo_inference as base','from . import echo_inference as base')
        (vendor/'cbt'/name).write_text(text,encoding='utf-8')
    code=[{'path':p.relative_to(ROOT).as_posix(),'sha256':digest(p)} for p in sorted(vendor.rglob('*.py'))]
    manifest={'schemaVersion':'echo-core-models-v1','models':{'xlmr':{'path':'xlmr-v2','maxLength':384,'stride':64},'e4':{'path':'e4-c','maxLength':256,'overlap':128},'cbt':{'path':'cbt','base':'cbt/base','adapter':'cbt/adapter','seqLength':4096,'maxNewTokens':900}},'files':entries,'inferenceCode':code}
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(f'Verified {len(entries)} model files, {sum(x["bytes"] for x in entries):,} bytes')

if __name__=='__main__': main()
