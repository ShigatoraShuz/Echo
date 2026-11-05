"""Final v4 expression inference. Image bytes and features remain in memory."""
import sys,json,hashlib,io,contextlib,base64
from pathlib import Path
from datetime import datetime,timezone

class FaceEngine:
 def __init__(self,root):
  self.root=Path(root).resolve()
  with contextlib.redirect_stdout(sys.stderr):
   for name,digest in json.loads((self.root/'package_checksums.json').read_text()).items():
    path=(self.root/name).resolve()
    if path.parent!=self.root or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Package integrity failure')
   sys.path.insert(0,str(self.root))
   import echoface_v4_runtime as rt
   import joblib
   from PIL import Image
   artifact=joblib.load(self.root/'selected_model.joblib')
   if artifact['runtime_version']!=rt.RUNTIME_VERSION or artifact['runtime_sha256']!=rt.sha256_file(rt.__file__):raise ValueError('Runtime mismatch')
   if artifact['asset_sha256']!=rt.sha256_file(self.root/'face_landmarker.task'):raise ValueError('Asset mismatch')
   self.rt=rt
   self.artifact=artifact
   self.detector=rt.create_landmarker(self.root/'face_landmarker.task',artifact['preprocessing'])
 def predict(self,data):
  if not data or len(data)>2*1024*1024:raise ValueError("Invalid capture size")
  rt=self.rt;artifact=self.artifact;detector=self.detector
  from PIL import Image
  Image.MAX_IMAGE_PIXELS=4000000
  with Image.open(io.BytesIO(data)) as im:
   if im.format not in ('JPEG','PNG','WEBP') or max(im.size)>2048 or min(im.size)<32 or getattr(im,'n_frames',1)!=1:raise ValueError('Invalid capture')
   im.verify()
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
  finally:pass
  result.update(modelFingerprint=rt.sha256_file(self.root/'selected_model.joblib'),inferenceVersion='echoface-v4.0.0:'+artifact['runtime_sha256'][:16],generatedAt=datetime.now(timezone.utc).isoformat().replace('+00:00','Z'))
  return result
 def close(self):self.detector.close()

def main():
 engine=None
 try:
  engine=FaceEngine(sys.argv[1])
  if '--resident' not in sys.argv:
   print(json.dumps(engine.predict(sys.stdin.buffer.read(2*1024*1024+1)),allow_nan=False));return
  print(json.dumps({'ready':True}),flush=True)
  for line in iter(lambda:sys.stdin.buffer.readline(3*1024*1024+1),b''):
   if len(line)>3*1024*1024 or not line.endswith(b'\n'):break
   packet=json.loads(line)
   try:
    data=base64.b64decode(packet['audioImage'],validate=True)
    if not data or len(data)>2*1024*1024:raise ValueError('Invalid capture size')
    with contextlib.redirect_stdout(sys.stderr):result=engine.predict(data)
    reply={'id':packet['id'],'result':result}
   except Exception:reply={'id':packet['id'],'error':'FACE_INFERENCE_FAILED'}
   print(json.dumps(reply,allow_nan=False),flush=True)
   data=b"";packet.clear();reply.clear();result=None
 except Exception as error:
  code='FACE_ENV_IMPORT_FAILED' if isinstance(error,ImportError) else 'FACE_ENV_ACCESS_DENIED' if isinstance(error,PermissionError) else 'FACE_PACKAGE_UNAVAILABLE'
  print(json.dumps({'ready':False,'code':code}),flush=True)
 finally:
  if engine:engine.close()

if __name__=='__main__':main()
