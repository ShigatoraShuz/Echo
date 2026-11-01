"""Final v4 expression inference. Image bytes and features remain in memory."""
import sys,json,hashlib,io,contextlib
from pathlib import Path
from datetime import datetime,timezone
root=Path(sys.argv[1]).resolve()
with contextlib.redirect_stdout(sys.stderr):
 for name,digest in json.loads((root/'package_checksums.json').read_text()).items():
  path=(root/name).resolve()
  if path.parent!=root or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Package integrity failure')
 sys.path.insert(0,str(root))
 import echoface_v4_runtime as rt
 import joblib
 from PIL import Image
 artifact=joblib.load(root/'selected_model.joblib')
 if artifact['runtime_version']!=rt.RUNTIME_VERSION or artifact['runtime_sha256']!=rt.sha256_file(rt.__file__):raise ValueError('Runtime mismatch')
 if artifact['asset_sha256']!=rt.sha256_file(root/'face_landmarker.task'):raise ValueError('Asset mismatch')
 data=sys.stdin.buffer.read(2*1024*1024+1)
 if not data or len(data)>2*1024*1024:raise ValueError('Invalid capture size')
 Image.MAX_IMAGE_PIXELS=4000000
 with Image.open(io.BytesIO(data)) as im:
  if im.format not in ('JPEG','PNG','WEBP') or max(im.size)>2048:raise ValueError('Invalid capture')
  im.verify()
 detector=rt.create_landmarker(root/'face_landmarker.task',artifact['preprocessing'])
 try:
  try:
   vectors,qc,statuses,_=rt.extract_variants(data,detector,artifact['preprocessing'])
  except ValueError as error:
   if not str(error).startswith('Expected exactly one face;'):raise
   vectors,qc,statuses={},{},{artifact['variant']:'unavailable'}
  result={'schemaVersion':'echo-face-expression-v1','status':'unavailable','reason':'no_usable_face'}
  if statuses[artifact['variant']]=='ok':
   vector=vectors[artifact['variant']][artifact['feature_indices']]
   scores=artifact['model'].predict_proba(vector[None,:])[0]
   classes=artifact['model'].classes_
   result={'schemaVersion':'echo-face-expression-v1','status':'available','experimental':True,'prediction':str(classes[scores.argmax()]),'scoreType':'uncalibrated_class_probability','classProbabilities':dict(zip(classes.tolist(),scores.astype(float).tolist())),'quality':qc}
 finally:detector.close()
 result.update(modelFingerprint=rt.sha256_file(root/'selected_model.joblib'),inferenceVersion='echoface-v4.0.0:'+artifact['runtime_sha256'][:16],generatedAt=datetime.now(timezone.utc).isoformat().replace('+00:00','Z'))
print(json.dumps(result,allow_nan=False))
