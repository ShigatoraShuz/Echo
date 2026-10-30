"""Synthetic extra-language speech checks, one GPU pipeline at a time."""
import os,json,time,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
os.environ.update(HF_HOME=str(ROOT/'runtime-cache/speech-hf'),HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
from app.core.config import Settings
from app.model.core import CoreRuntime
runtime=CoreRuntime(Settings(core_models_enabled=True,models_root=str(ROOT/'models')))
results=[]
try:
 for language,text in [('fil','Kumusta ka? Maaari tayong magpahinga at huminga nang dahan-dahan.'),('taglish','Okay lang magpahinga. We can take one small step, dahan-dahan lang.')]:
  started=time.perf_counter()
  try:
   speech=runtime.speech({'task':'speak','text':text});tts=time.perf_counter()-started
   transcript=runtime.speech({'task':'transcribe','audio':speech['audio']})
   results.append({'language':language,'audioBytes':len(base64.b64decode(speech['audio'])),'ttsSeconds':tts,'roundtripSeconds':time.perf_counter()-started,'text':transcript['text'],'nonempty':bool(transcript['text'].strip()),'metrics':runtime.metrics()})
  except Exception as error:results.append({'language':language,'error':type(error).__name__,'detail':str(error)})
finally:
 runtime.release()
 (ROOT/'runtime-cache/voice-language-smoke.json').write_text(json.dumps(results,indent=2))
