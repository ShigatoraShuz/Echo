import argparse,datetime,json,time,traceback
from pathlib import Path
from engines import Engines,ROOT
from text_audio import prepare,chunks,validate,assemble
def check(request):
    if request.get('model','MOSS') != 'MOSS':raise ValueError('Only MOSS is supported.')
    if 'voice' in request:raise ValueError('The Buddy voice is fixed; voice selection is not supported.')
    prepared=prepare(request.get('text'),request.get('language'));chunks(prepared)
    return prepared
def generate(engine,request,progress=lambda message:None,job_id=None):
    import numpy as np
    import soundfile as sf
    import torch
    prepared=check(request);torch.manual_seed(42)
    job_id=job_id or datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    folder=ROOT/'results'/job_id;folder.mkdir(parents=True,exist_ok=True)
    report=dict(request,job=job_id,preparedText=prepared,status='running',segments=[],seed=42,listeningQuality='unverified',timingScope='TTS only; excludes STT, CBT and playback',settings={'maxFrames':4096,'MOSS':'installed generation defaults','gapMilliseconds':0})
    begin=time.perf_counter()
    def save():(folder/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    save()
    try:
        report['model']='MOSS'
        progress('Loading MOSS');engine.load();report['loadSeconds']=time.perf_counter()-begin
        voice_start=time.perf_counter();meta=engine.ensure_voice(progress)
        report['voiceReference']={'sha256':meta['sha256'],'origin':meta['origin']}
        report['voicePreparationSeconds']=time.perf_counter()-voice_start
        report['settings'].update(audioTemperature=1.0,audioTopP=.95,audioTopK=50,repetitionPenalty=1.0)
        torch.manual_seed(42)
        waves,rate=[],None
        for index,text in enumerate(chunks(prepared)):
            progress('Generating segment '+str(index+1));start=time.perf_counter()
            wave,sr,metadata=engine.synthesize(text.strip(),request['language']);wave=validate(wave,sr)
            if rate is not None and (sr!=rate or wave.shape[1]!=waves[0].shape[1]):raise ValueError('Inconsistent segment formats.')
            rate=sr;waves.append(wave);sf.write(folder/f'segment-{index+1:03}.wav',wave,rate,subtype='FLOAT')
            report['segments'].append(dict(text=text,generationSeconds=time.perf_counter()-start,audioSeconds=len(wave)/rate,sampleRate=rate,channels=wave.shape[1],peak=float(np.abs(wave).max()),**metadata))
            if index==0:report['firstSegmentReadySeconds']=time.perf_counter()-begin
            save()
        raw,processed=assemble(waves,rate)
        sf.write(folder/'original.wav',raw,rate,subtype='FLOAT');sf.write(folder/'speech.wav',processed,rate,subtype='PCM_16')
        report.update(status='complete',sampleRate=rate,channels=processed.shape[1],audioSeconds=len(processed)/rate)
    except Exception as exc:
        message='MOSS ran out of GPU memory. Close other GPU workloads and retry.' if isinstance(exc,torch.cuda.OutOfMemoryError) else str(exc)
        report.update(status='failed',error=message);(folder/'error.txt').write_text(traceback.format_exc(),encoding='utf-8')
    finally:report['totalSeconds']=time.perf_counter()-begin;save()
    return report
def worker(tasks,replies):
    engine=Engines()
    try:
        while True:
            item=tasks.get()
            if item is None:break
            job_id,request=item
            try:replies.put((job_id,'result',generate(engine,request,lambda message:replies.put((job_id,'progress',message)),job_id)))
            except Exception as exc:replies.put((job_id,'result',{'status':'failed','error':str(exc)}))
    finally:engine.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',choices=['MOSS'],default='MOSS');p.add_argument('--language',choices=['English','Filipino','Taglish'],default='English')
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--text');g.add_argument('--text-file',type=Path)
    args=vars(p.parse_args());file=args.pop('text_file')
    if file:args['text']=file.read_text(encoding='utf-8')
    engine=Engines()
    try:report=generate(engine,args,print);print(json.dumps(report,ensure_ascii=True,indent=2));print('Results:',ROOT/'results'/report['job'])
    finally:engine.close()
    raise SystemExit(0 if report['status']=='complete' else 1)
