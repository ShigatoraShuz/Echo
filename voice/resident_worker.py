import contextlib,json,os,sys,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',HF_HOME=str(ROOT/'cache/hf'),HF_MODULES_CACHE=str(ROOT/'cache/modules'),TORCHINDUCTOR_CACHE_DIR=str(ROOT/'cache/torch'),CUDA_CACHE_PATH=str(ROOT/'cache/cuda'))
kind=sys.argv[1];service=None
REQUEST_ID=None
def emit(segment):
    print(json.dumps({'id':REQUEST_ID,'event':'segment_ready','segment':segment}),file=sys.__stdout__,flush=True)
def run(request):
    global service
    import torch
    if not torch.cuda.is_available():raise RuntimeError('CUDA required; no fallback.')
    if kind=='cbt':
        from cbt_bridge import run as cbt
        return cbt(request)
    if service is None:
        sys.path.insert(0,str(ROOT/'upstream'))
        from moss_tts_nano_runtime import NanoTTSService,VoicePreset
        from voice_store import VoiceStore
        VoiceStore(ROOT/'voices').read()
        service=NanoTTSService(checkpoint_path=ROOT/'models/nano',audio_tokenizer_path=ROOT/'models/codec',device='cuda',dtype='bfloat16',attn_implementation='sdpa',voice_presets={'Buddy':VoicePreset('Buddy',ROOT/'voices/buddy/sample.wav','Saved generated Buddy voice')},output_dir=ROOT/'results')
        from wav_io import install_wav_io
        install_wav_io(service.get_model());codec=service._load_audio_tokenizer_locked(tts_attn_implementation='sdpa')
        # Cache the encoded fixed reference, never decode outputs or generated speech.
        import copy
        for method in ('encode','batch_encode'):
            if not hasattr(codec,method):continue
            original=getattr(codec,method)
            def cached(*args,_method=original,_cache={},**kwargs):
                def fingerprint(x):
                    if torch.is_tensor(x):return hashlib.sha256(x.detach().float().cpu().numpy().tobytes()).hexdigest()
                    if isinstance(x,(list,tuple)):return tuple(fingerprint(i) for i in x)
                    return repr(x)
                key=(fingerprint(args),repr(sorted(kwargs.items())))
                if key not in _cache:
                    _cache.clear();_cache[key]=copy.deepcopy(_method(*args,**kwargs))
                return copy.deepcopy(_cache[key])
            setattr(codec,method,cached)
    if request.get('check'):return {'device':'cuda','model':'Nano + Nano codec'}
    if request.get('segmentMode','buffered')=='sentences_2_then_3':
        from sentence_batch import synthesize
        return synthesize(service,request,ROOT,emit)
    from text_audio import prepare,chunks,validate,assemble
    import soundfile as sf
    text=prepare(request['text'],request.get('language','English'));job=request['job']
    if len(job)!=32 or any(c not in '0123456789abcdef' for c in job):raise ValueError('Invalid job ID.')
    folder=ROOT/'results'/job;folder.mkdir(parents=True,exist_ok=True);start=time.perf_counter();waves=[];segments=[]
    from segmenting import speech_segments
    for index,part in enumerate(speech_segments(text)):
        path=folder/f'segment-{index+1:03}.wav'
        with torch.inference_mode():
            result=service.synthesize(text=part.strip(),voice='Buddy',prompt_audio_path=ROOT/'voices/buddy/sample.wav',output_audio_path=path,seed=42,max_new_frames=4096,voice_clone_max_text_tokens=0,tts_max_batch_size=1,codec_max_batch_size=1)
        ids=result.get('audio_token_ids')
        if ids is not None and len(ids)>=4096:raise RuntimeError('Nano exhausted its frame budget; speech is incomplete.')
        wave,rate=sf.read(path,dtype='float32',always_2d=True);wave=validate(wave,rate)
        if waves and (rate!=previous_rate or wave.shape[1]!=waves[0].shape[1]):raise ValueError('Inconsistent segment formats.')
        previous_rate=rate;waves.append(wave)
        _,playback=assemble([wave],rate)
        target=folder/f'play-{index:03}.wav';temporary=folder/f'play-{index:03}.tmp.wav'
        sf.write(temporary,playback,rate,subtype='PCM_16');os.replace(temporary,target)
        info={'index':index,'text':part,'audioSeconds':len(wave)/rate,'sampleRate':rate,'channels':wave.shape[1],'readySeconds':time.perf_counter()-start}
        segments.append(info);emit(info)
    raw,processed=assemble(waves,rate);sf.write(folder/'original.wav',raw,rate,subtype='FLOAT');sf.write(folder/'speech.wav',processed,rate,subtype='PCM_16');torch.cuda.synchronize()
    report={'status':'complete','model':'MOSS-TTS-Nano','preparedText':text,'segments':segments,'sampleRate':rate,'channels':processed.shape[1],'totalSeconds':time.perf_counter()-start,'audioSeconds':len(processed)/rate,'freeGPUBytes':torch.cuda.mem_get_info()[0],'voiceReference':{'sha256':hashlib.sha256((ROOT/'voices/buddy/sample.wav').read_bytes()).hexdigest()},'languageStatus':'supported' if request.get('language','English')=='English' else 'experimental-unsupported','listeningQuality':'unverified'}
    (folder/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');return report
for line in sys.stdin:
    key=None
    try:
        message=json.loads(line);key=message['id'];REQUEST_ID=key
        with contextlib.redirect_stdout(sys.stderr):result=run(message['request'])
        print(json.dumps({'id':key,'result':result}),flush=True)
    except Exception as exc:print(json.dumps({'id':key,'error':str(exc)}),flush=True)
