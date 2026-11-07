"""Pinned MOSS v1.5 native CLI adapter: text stdin and WAV stdout only."""
import base64,hashlib,io,json,os,re,subprocess,threading,time
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from app.buddy.config import HERE,VOICE_SHA,digest
from app.buddy.job import spawn_owned,terminate_owned
from app.buddy.text_audio import validate,assemble

def runtime_inventory(manifest):
 required={'artifacts/moss-v15-q4_k_m.gguf','artifacts/moss_tts_audio_encoder_f16.gguf','artifacts/moss_tts_audio_decoder_f16.gguf','build/bin/Release/llama-moss-tts.exe'}
 entries=[e for e in manifest['files'] if e['path'] in required or (e['path'].startswith('build/bin/Release/') and e['path'].lower().endswith('.dll'))]
 if not required.issubset({e['path'] for e in entries}):raise RuntimeError('BUDDY_MOSS_ASSET_MISSING')
 return entries

class NativeMoss:
 def __init__(self,progress=None):
  progress=progress or (lambda stage:None)
  progress('asset_verification')
  self.root=Path(os.environ.get('BUDDY_MOSS_NATIVE_ROOT',HERE.parents[2]/'models/moss-native')).resolve()
  path=self.root/'manifest.json'
  if not path.is_file():raise RuntimeError('BUDDY_MOSS_ASSET_MISSING')
  lock=json.loads(HERE.joinpath('moss-native.lock.json').read_text(encoding='utf-8'))
  if lock.get('syntheticInferenceValidated') is not True and os.environ.get('ECHO_MOSS_NATIVE_VALIDATE')!='1':raise RuntimeError('BUDDY_MOSS_VALIDATION_REQUIRED')
  if digest(path)!=lock['manifestSHA256']:raise RuntimeError('BUDDY_MOSS_MANIFEST_INTEGRITY_FAILED')
  self.manifest=json.loads(path.read_text(encoding='utf-8'))
  if self.manifest.get('modelRevision')!='cdd3b911b1585e3f2dbc7775ef10f9926f58850a' or self.manifest.get('forkRevision')!='b785003ba497794ecfa337c3e47f01af79489888':raise RuntimeError('BUDDY_MOSS_IDENTITY_FAILED')
  for entry in runtime_inventory(self.manifest):
   path=(self.root/entry['path']).resolve()
   if not path.is_file():raise RuntimeError('BUDDY_MOSS_ASSET_MISSING')
   if not path.is_relative_to(self.root) or path.stat().st_size!=entry['bytes'] or digest(path)!=entry['sha256']:raise RuntimeError('BUDDY_MOSS_INTEGRITY_FAILED')
  self.binary=self.root/'build/bin/Release/llama-moss-tts.exe'
  self.model=self.root/'artifacts/moss-v15-q4_k_m.gguf'
  self.encoder=self.root/'artifacts/moss_tts_audio_encoder_f16.gguf';self.decoder=self.root/'artifacts/moss_tts_audio_decoder_f16.gguf'
  for path in (self.binary,self.model,self.encoder,self.decoder):
   if not path.is_file():raise RuntimeError('BUDDY_MOSS_ASSET_MISSING')
  progress('reference_validation')
  original=HERE.parents[2]/'models/buddy/voices/buddy/sample.wav'
  if digest(original)!=VOICE_SHA:raise RuntimeError('BUDDY_VOICE_IDENTITY_FAILED')
  wave,rate=sf.read(original,dtype='float32',always_2d=True);validate(wave,rate)
  self.reference=self.root/'buddy-reference-24k.wav'
  expected=resample_poly(wave.mean(axis=1),24000,rate)
  if not self.reference.exists():
   temporary=self.reference.with_suffix('.tmp');sf.write(temporary,expected,24000,format='WAV',subtype='PCM_16');os.replace(temporary,self.reference)
  actual,rate=sf.read(self.reference,dtype='float32')
  if rate!=24000 or actual.ndim!=1 or len(actual)!=len(expected) or not np.allclose(actual,expected,atol=1/32768+1e-6):raise RuntimeError('BUDDY_MOSS_REFERENCE_INVALID')
  self.identity={'runtimeManifestSHA256':lock['manifestSHA256'],'artifactSHA256':next(x['sha256'] for x in self.manifest['files'] if x['path']=='artifacts/moss-v15-q4_k_m.gguf'),'codecRevision':self.manifest['codecRevision'],'runtimeRevision':self.manifest['forkRevision'],'derivedReferenceSHA256':digest(self.reference),'providerName':'MOSS-TTS-v1.5','modelVersion':self.manifest['modelRevision'],'inferenceVersion':'openmoss-native-memory-io-v1','engine':'OpenMOSS-llama.cpp','quantization':'Q4_K_M','voiceReferenceSHA256':VOICE_SHA,'nativeSampleRate':24000,'nativeChannels':1,'sampleRate':48000,'channels':2}
 def synthesize(self,text,language="English"):
  import torch
  from app.buddy.gpu_memory import require_headroom
  # Native encoder, backbone and decoder run sequentially inside one process.
  required=max(self.model.stat().st_size,self.encoder.stat().st_size,self.decoder.stat().st_size)+1024**3
  require_headroom(torch,additional_bytes=required)
  arguments=[str(self.binary),'-m',str(self.model),'--audio-encoder-model',str(self.encoder),'--audio-decoder-model',str(self.decoder),'--reference-audio',str(self.reference),'--language',{'English':'en','Filipino':'tl','Taglish':''}[language],'--text-file','-','--wav-out','-','--max-new-tokens','512','-ngl','-1','--seed','42']
  env={key:os.environ[key] for key in ('SYSTEMROOT','WINDIR','PATH','TEMP','TMP','CUDA_VISIBLE_DEVICES') if key in os.environ}
  process=spawn_owned(arguments,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,cwd=str(self.binary.parent),creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),resource_limits={'memory_bytes':28_000_000_000,'cpu_percent':60})
  output=[];errors=[];offloads=[];overflow=threading.Event()
  def read_wave():
   value=process.stdout.read(16*1024**2+1)
   if len(value)>16*1024**2:overflow.set();terminate_owned(process)
   else:output.append(value)
  def discard_logs():
   while line:=process.stderr.readline(8193):
    found=re.search(rb'offloaded (\d+)/(\d+) layers to GPU',line)
    if found:offloads.append(tuple(map(int,found.groups())))
    if b'out of memory' in line.lower():errors.append('BUDDY_MOSS_INSUFFICIENT_MEMORY')
    if b'ECHO_REQUIRE_COMPLETE' in line:errors.append('BUDDY_MOSS_AUDIO_INCOMPLETE')
    if b'cuda error' in line.lower() or b'no kernel image' in line.lower():errors.append('BUDDY_MOSS_CUDA_RUNTIME_FAILED')
  reader=threading.Thread(target=read_wave,daemon=True);logger=threading.Thread(target=discard_logs,daemon=True);reader.start();logger.start()
  try:
   process.stdin.write(text.encode('utf-8'));process.stdin.close()
   try:process.wait(timeout=300)
   except subprocess.TimeoutExpired:raise RuntimeError('BUDDY_MOSS_INFERENCE_TIMEOUT') from None
   reader.join(5);logger.join(5)
   if overflow.is_set():raise RuntimeError('BUDDY_MOSS_AUDIO_LIMIT')
   if process.returncode:raise RuntimeError(errors[0] if errors else f'BUDDY_MOSS_NATIVE_EXIT_{process.returncode & 0xffffffff:08X}')
   if len(offloads)<3 or any(done!=total for done,total in offloads):raise RuntimeError('BUDDY_MOSS_GPU_OFFLOAD_MISMATCH')
   if not output or not output[0].startswith(b'RIFF'):raise RuntimeError('BUDDY_MOSS_AUDIO_INVALID')
   wave,rate=sf.read(io.BytesIO(output[0]),dtype='float32',always_2d=True);validate(wave,rate)
   if len(wave)>45*rate:raise RuntimeError('BUDDY_MOSS_AUDIO_LIMIT')
   if rate!=48000:wave=resample_poly(wave,48000,rate,axis=0)
   if wave.shape[1]==1:wave=np.repeat(wave,2,axis=1)
   wave=validate(wave,48000);_,wave=assemble([wave],48000)
   require_headroom(torch)
   return base64.b64encode((np.clip(wave,-1,1)*32767).astype('<i2').tobytes()).decode()
  finally:
   terminate_owned(process)
   for stream in (process.stdout,process.stderr):stream.close()
 def call(self,request):
  import torch
  from app.buddy.gpu_memory import require_headroom
  if request.get('check'):return {'model':self.identity,'requiredGpuBytes':max(self.model.stat().st_size,self.encoder.stat().st_size,self.decoder.stat().st_size)+1024**3,'freeGpuBytes':require_headroom(torch)['freeBytes']}
  texts=request['texts']
  if not 1<=len(texts)<=3 or any(not isinstance(t,str) or not t.strip() or len(t)>12000 for t in texts):raise ValueError('Invalid native sentences')
  start=time.perf_counter();segments=[{'text':t,'audio':self.synthesize(t,request.get("language","English")),'sampleRate':48000,'channels':2} for t in texts]
  return {'segments':segments,'model':self.identity,'seconds':time.perf_counter()-start,'freeGpuBytes':require_headroom(torch)['freeBytes']}
