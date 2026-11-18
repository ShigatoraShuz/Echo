"""Opt-in local checks using generated speech and a blank image, never user media."""
import base64,io,json,os,re,subprocess,sys,threading,uuid,wave,difflib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service'))

def main():
    config=json.loads((ROOT/'backend/.local-development/buddy-runtime.json').read_text('utf-8-sig'))
    os.environ.update(ECHO_BUDDY_ENABLED='false',MODELS_ROOT=str(ROOT/'models'),BUDDY_WHISPER_PYTHON=config['whisperPython'])
    folder=ROOT/'runtime-cache/buddy-audit';folder.mkdir(parents=True,exist_ok=True)
    audio=folder/'journal-synthetic-dictation.wav'
    phrase='Today I finished one assignment and took a short walk. I want to write about my afternoon.'
    script="Add-Type -AssemblyName System.Speech; $journalVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $journalVoice.SetOutputToWaveFile('"+str(audio).replace("'","''")+"'); $journalVoice.Speak('"+phrase+"'); } finally { $journalVoice.Dispose() }"
    subprocess.run(['powershell.exe','-NoProfile','-Command',script],check=True,capture_output=True)
    from app.model.core import CoreRuntime
    from app.buddy.runtime import BuddyRuntime
    from app.model.face_transport import ResidentFaceRuntime
    from app.core.exceptions import TalkCancelledError
    core=CoreRuntime.__new__(CoreRuntime);core.lock=threading.RLock();core.instance=None;core.talk=None;core.buddy=BuddyRuntime(core)
    face=ResidentFaceRuntime(ROOT/'models');session=str(uuid.uuid4());report={}
    try:
        core.dictation({'task':'warm_whisper','sessionId':session});print('Whisper-only preparation ready',flush=True)
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.routes.core import router
        from app.core.config import get_settings
        token='synthetic-journal-'+uuid.uuid4().hex;os.environ['AI_SERVICE_TOKEN']=token;get_settings.cache_clear()
        app=FastAPI();app.state.model_runtime=core;app.include_router(router)
        with TestClient(app) as client:
            assert client.post('/v1/dictation',json={'task':'warm_whisper','sessionId':session}).status_code in (401,403)
            response=client.post('/v1/dictation',headers={'Authorization':'Bearer '+token},json={'task':'transcribe','sessionId':session,'audio':base64.b64encode(audio.read_bytes()).decode()})
            assert response.status_code==200,response.text
            result=response.json()
        words=lambda text:re.findall('[a-z]+',text.lower())
        agreement=difflib.SequenceMatcher(None,words(phrase),words(result['text'])).ratio()
        assert agreement>=.9,(agreement,result['text'])
        assert list(core.buddy.workers)==['whisper'] and core.talk is None
        silence=io.BytesIO()
        with wave.open(silence,'wb') as wav:wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\0'*32000)
        assert core.dictation({'task':'transcribe','sessionId':session,'audio':base64.b64encode(silence.getvalue()).decode()})['text']==''
        cancelled=threading.Event();cancelled.set()
        try:core.dictation({'task':'transcribe','sessionId':session,'audio':'YQ=='},cancelled)
        except TalkCancelledError:pass
        else:raise AssertionError('Cancellation was ignored')
        report['whisper']={'text':result['text'],'tokenAgreement':agreement,'workers':list(core.buddy.workers),'buddyDisabled':core.talk is None,'silencePassed':True,'cancellationPassed':True,'privateHttpEndpointPassed':True}
        core.dictation({'task':'close','sessionId':session});assert core.buddy.owner is None
        from PIL import Image
        image=io.BytesIO();Image.new('RGB',(320,240),'white').save(image,format='PNG')
        assert face.prepare()['ready']
        output=face.predict(base64.b64encode(image.getvalue()).decode());assert output['status']=='unavailable' and output['reason']=='no_usable_face'
        report['face']={'ready':True,'blankFrameStatus':output['status'],'reason':output['reason'],'modelFingerprint':output['modelFingerprint']}
        portrait=ROOT/'ai-service/.venv-face/Lib/site-packages/matplotlib/mpl-data/sample_data/grace_hopper.jpg'
        if portrait.is_file():
            positive=face.predict(base64.b64encode(portrait.read_bytes()).decode())
            assert positive['status']=='available',positive
            report['face']['portraitFixture']='Bundled Matplotlib grace_hopper.jpg; not user camera media'
            report['face']['positiveResult']=positive
    finally:
        children=[worker.process for worker in core.buddy.workers.values()];core.buddy.close();face.close()
        report['workersReleased']=all(child.poll() is not None for child in children) and face.process is None
        (folder/'journal-input-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    assert report['workersReleased']
    print(json.dumps(report),flush=True)
if __name__=='__main__':main()
