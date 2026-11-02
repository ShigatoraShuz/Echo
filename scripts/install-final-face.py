"""Install the owner's complete trusted v4 export; no download or retraining."""
import argparse,hashlib,json,shutil,re,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('bundle',type=Path);args=p.parse_args()
source=args.bundle.resolve();manifest=json.loads((source/'package_checksums.json').read_text())
required={'selected_model.joblib','echoface_v4_runtime.py','face_landmarker.task','metadata.json','requirements.txt'}
if not required.issubset(manifest):raise ValueError('Incomplete final v4 bundle')
for name,digest in manifest.items():
 target=(source/name).resolve()
 if target.parent!=source or not re.fullmatch('[a-f0-9]{64}',digest) or hashlib.sha256(target.read_bytes()).hexdigest()!=digest:raise ValueError('Bundle checksum mismatch')
destination=Path(os.environ.get('MODELS_ROOT',str(Path(__file__).resolve().parents[2]/'models')))/'face-final';destination.mkdir(parents=True,exist_ok=True)
for name in [*manifest,'package_checksums.json']:shutil.copy2(source/name,destination/name)
print('Verified final face bundle installed. Model files remain Git-ignored.')
