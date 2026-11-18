"""Opt-in Nano/Whisper check with synthetic replies; no account or microphone data."""
import base64
import difflib
import json
import os
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service'))


def main():
    import numpy as np
    config=json.loads((ROOT/'backend/.local-development/buddy-runtime.json').read_text('utf-8-sig'))
    os.environ.update(MODELS_ROOT=str(ROOT/'models'),BUDDY_NANO_PYTHON=config['nanoPython'],BUDDY_WHISPER_PYTHON=config['whisperPython'])
    from app.buddy.config import paths
    from app.buddy.process import Process
    from app.buddy.text_audio import prepare
    from app.buddy.sentences import spoken_sentences
    report={'provider':'MOSS-TTS-Nano','cases':[],'synthetic':True,'humanListeningRequired':True}
    nano=whisper=None
    try:
        nano=Process(paths()['nano'],'nano');nano.call({'check':True})
        print('Nano ready for synthetic audio',flush=True)
        whisper=Process(paths()['whisper'],'whisper');whisper.call({'check':True})
        cases=[('ordinary','Schoolwork can feel heavy. Open one document and write a single heading.'),
               ('ten-items','\n'.join(f'{i}. **Action {i}**: Open your notebook and write one useful detail.' for i in range(1,11)))]
        for name,original in cases:
            text=prepare(original,'English',spoken=True)
            parts=nano.call({'prepareTexts':spoken_sentences(text)})['parts']
            assert ''.join(parts)==text
            recognized=[];total_frames=0
            for index,part in enumerate(parts):
                result=nano.call({'texts':[part]})
                segment=result['segments'][0]
                assert segment['text']==part and segment['sampleRate']==48000 and segment['channels']==2
                pcm=np.frombuffer(base64.b64decode(segment['audio']),dtype='<i2').reshape(-1,2)
                assert len(pcm) and np.max(np.abs(pcm.astype(np.int32)))>1
                total_frames+=len(pcm)
                mono=pcm.astype(np.float32).mean(axis=1)[::3].astype('<i2')
                assert len(mono)<=60*16000
                transcript=whisper.call({'audio':base64.b64encode(mono.tobytes()).decode(),'language':'English'})['text']
                recognized.append(transcript)
                print(f'{name}: segment {index+1}/{len(parts)} checked',flush=True)
            words=lambda value:re.findall(r'[a-z]+',value.lower())
            agreement=difflib.SequenceMatcher(None,words(text),words(' '.join(recognized))).ratio()
            report['cases'].append({'case':name,'segments':len(parts),'seconds':round(total_frames/48000,2),'coveragePreserved':True,'asrTokenAgreement':round(agreement,4)})
            assert agreement>=.65, f'Synthetic ASR agreement too low: {name}'
        print(json.dumps(report,indent=2),flush=True)
        target=ROOT/'runtime-cache/buddy-audit/speech-preparation-check.json'
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2),encoding='utf-8')
    finally:
        if nano:nano.close()
        if whisper:whisper.close()


if __name__=='__main__':main()
