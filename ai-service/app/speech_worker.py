"""Short-lived offline speech pipeline. No reference voice inputs."""
import base64,io,json,os,sys
from pathlib import Path
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
def decode_recording(data):
 import io,av,numpy as np
 if len(data)>10*1024*1024:raise ValueError('Audio too large')
 pieces=[];count=0
 with av.open(io.BytesIO(data),options={'protocol_whitelist':'pipe'}) as container:
  if container.streams.video or not container.streams.audio:raise ValueError('Audio-only recording required')
  resampler=av.AudioResampler(format='s16',layout='mono',rate=16000)
  for frame in container.decode(audio=0):
   for converted in resampler.resample(frame):
    part=converted.to_ndarray().reshape(-1);count+=len(part)
    if count>60*16000:raise ValueError('Audio exceeds 60 seconds')
    pieces.append(part.astype(np.float32)/32768)
 samples=np.concatenate(pieces) if pieces else np.zeros(0,dtype=np.float32)
 return samples
def run(root,request):
 import torch,numpy as np,soundfile as sf
 torch.cuda.reset_peak_memory_stats()
 if request['task']=='transcribe':
  from faster_whisper import WhisperModel
  import av
  data=base64.b64decode(request['audio'],validate=True)
  if len(data)>10*1024*1024:raise ValueError('Audio too large')
  samples=decode_recording(data)
  if len(samples)>60*16000:raise ValueError('Audio exceeds 60 seconds')
  if len(samples)<1600 or np.max(np.abs(samples))<0.005:return {'text':''}
  model=WhisperModel(str(root/'whisper'),device='cuda',compute_type='float16',local_files_only=True)
  segments,info=model.transcribe(samples,beam_size=5,vad_filter=True,condition_on_previous_text=False)
  return {'text':' '.join(x.text.strip() for x in segments if x.no_speech_prob<0.6).strip(),'language':info.language}
 from transformers import AutoModel
 from transformers.dynamic_module_utils import get_class_from_dynamic_module
 from transformers.processing_utils import ProcessorMixin
 base_processor=get_class_from_dynamic_module('processing_moss_tts.MossTTSLocalProcessor',str(root/'moss'),local_files_only=True)
 class ProcessorCompat(base_processor):
  def __init__(self,tokenizer,audio_tokenizer=None,model_config=None,**kwargs):
   ProcessorMixin.__init__(self,tokenizer=tokenizer)
   self.tokenizer=tokenizer;self.audio_tokenizer=audio_tokenizer;self.model_config=model_config
   for name in ('audio_user_slot_token','audio_assistant_slot_token','audio_start_token','audio_end_token'):
    setattr(self,name,tokenizer.convert_ids_to_tokens(int(getattr(model_config,name+'_id'))))
 processor=ProcessorCompat.from_pretrained(root/'moss',codec_path=str(root/'audio-tokenizer'),local_files_only=True,trust_remote_code=True)
 processor.audio_tokenizer=processor.audio_tokenizer.to(device='cuda')
 model=AutoModel.from_pretrained(root/'moss',local_files_only=True,trust_remote_code=True,dtype=torch.bfloat16,attn_implementation='sdpa').to('cuda').eval()
 import re
 chunks=[];current=''
 for word in request['text'].split():
  if len(word)>250:raise ValueError('Speech contains an oversized token')
  if current and len(current)+len(word)+1>250:chunks.append(current);current=''
  current=(current+' '+word).strip()
 if current:chunks.append(current)
 audio=[]
 for chunk in chunks:
  message=processor.build_user_message(text=chunk)
  batch=processor([[message]],mode='generation')
  with torch.inference_mode():
   output=model.generate(input_ids=batch['input_ids'].to('cuda'),attention_mask=batch['attention_mask'].to('cuda'),max_new_tokens=4096,do_sample=True,audio_temperature=1.7,audio_top_p=0.8,audio_top_k=25,audio_repetition_penalty=1.0)
  decoded=processor.decode(output)
  wave=next(m.audio_codes_list[0] for m in decoded if m is not None and getattr(m,'audio_codes_list',None))
  if isinstance(wave,torch.Tensor):wave=wave.detach().float().cpu().numpy()
  wave=np.asarray(wave).squeeze()
  if wave.ndim==2 and wave.shape[0] in (1,2):wave=wave.T
  audio.append(wave)
 rate=int(processor.model_config.sampling_rate)
 combined=np.concatenate(audio)
 if not combined.size or not np.isfinite(combined).all() or combined.shape[0]>rate*300:raise ValueError('Invalid generated audio')
 buffer=io.BytesIO();sf.write(buffer,combined,rate,format='WAV',subtype='PCM_16')
 return {'audio':base64.b64encode(buffer.getvalue()).decode(),'sampleRate':rate,'peakBytes':torch.cuda.max_memory_allocated()}
if __name__=='__main__':
 request=json.loads(Path(sys.argv[2]).read_text())
 result=run(Path(sys.argv[1]),request)
 Path(sys.argv[3]).write_text(json.dumps(result))
