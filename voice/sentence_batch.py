"""Local adapter over pinned Nano batching methods. No upstream file edits."""
import hashlib,json,time
import numpy as np
import soundfile as sf
from sentences import sentences,batches as sentence_batches
class RequestRejected(ValueError):pass
from text_audio import prepare,validate,assemble

def check_memory(model,device,count,requested):
    import torch
    free,total=torch.cuda.mem_get_info(device)
    if free-count*1024**3<2*1024**3:raise RequestRejected(f'Insufficient GPU headroom for {count} segments; no smaller batch substituted.')
    tts,codec=model._resolve_effective_voice_clone_batch_sizes(resolved_device=device,chunk_count=count,max_memory_per_sample_gb=1.0,requested_tts_max_batch_size=requested,requested_codec_max_batch_size=requested,realtime_streaming=False)
    if tts!=count or codec!=count:raise RequestRejected(f'Requested {count} segments but Nano resolved TTS={tts}, codec={codec}; no hidden batch reduction.')
    return free,tts,codec

def synthesize(service,request,root,emit):
    import torch
    size=3
    job=request['job']
    if len(job)!=32 or any(c not in '0123456789abcdef' for c in job):raise RequestRejected('Invalid job ID.')
    try:text=prepare(request['text'],request.get('language','English'))
    except ValueError as exc:raise RequestRejected(str(exc)) from exc
    started=time.perf_counter();model=service.get_model();device=service.device
    if device.type!='cuda':raise RequestRejected('Completed batching requires PyTorch CUDA.')
    tokenizer=model._load_text_tokenizer(text_tokenizer_path=str(root/'models/nano'))
    segments=sentences(text)
    if any(len(tokenizer.encode(part,add_special_tokens=False))>512 for part in segments):raise RequestRejected('A sentence exceeds 512 text tokens; shorten that sentence. It was not split or truncated.')
    folder=root/'results'/job;folder.mkdir(parents=True,exist_ok=True)
    torch.cuda.reset_peak_memory_stats(device)
    codec=service._load_audio_tokenizer_locked(tts_attn_implementation='sdpa');nq=model._resolve_inference_nq()
    reference=root/'voices/buddy/sample.wav';digest=hashlib.sha256(reference.read_bytes()).hexdigest()
    cache=getattr(service,'_buddy_batch_reference',None)
    torch.manual_seed(42)
    with torch.inference_mode():
        if not cache or cache[0]!=digest:
            wave,rate=model._load_reference_audio(reference,48000,2)
            codes=model._call_audio_encode(audio_tokenizer=codec,waveform=wave.to(device),sample_rate=rate)
            codes=model._mask_unused_audio_channels(model._normalize_audio_codes(codes),nq=nq).to(device)
            service._buddy_batch_reference=(digest,codes)
        prompt=service._buddy_batch_reference[1];waves=[];batches=[];published=[];index=0
        for group in sentence_batches(segments):
            start=time.perf_counter();free,tts,decode=check_memory(model,device,len(group),size);inputs=[];masks=[]
            for part in group:
                ids,mask=model.build_inference_input_ids(text=part,text_tokenizer=tokenizer,mode='voice_clone',prompt_text=None,prompt_audio_codes=prompt,device=device);inputs.append(ids);masks.append(mask)
            ids,mask=model._left_pad_inference_batch(input_id_batches=inputs,attention_mask_batches=masks,device=device)
            tokens=model._generate_audio_token_ids_with_fallback(prompt_input_ids=ids,attention_mask=mask,effective_nq=nq,max_new_frames=4096,do_sample=True,text_temperature=1.0,text_top_p=1.0,text_top_k=50,audio_temperature=.8,audio_top_p=.95,audio_top_k=25,audio_repetition_penalty=1.2,use_kv_cache=True,resolved_device=device)
            codes=[model._trim_generated_audio_token_ids(tokens[i],effective_nq=nq) for i in range(len(group))]
            if any(len(c)>=4096 for c in codes):raise RuntimeError('Batch exhausted frame budget; response incomplete.')
            decoded,rate=model._decode_audio_token_id_batch_to_waveforms(audio_tokenizer=codec,audio_token_id_batches=codes,target_sample_rate=48000,effective_nq=nq,resolved_device=device)
            if len(decoded)!=len(group):raise ValueError('Decoded batch size does not match text batch.')
            validated=[validate(w.detach().float().cpu().numpy().T,rate) for w in decoded]
            if rate!=48000 or any(w.shape[1]!=2 for w in validated):raise ValueError('Unexpected batch audio format.')
            if torch.cuda.mem_get_info(device)[0]<2*1024**3:raise RuntimeError('Batch left less than 2 GiB GPU headroom.')
            batches.append({'indices':list(range(index,index+len(group))),'requestedBatchSize':size,'actualTTSBatchSize':tts,'actualCodecBatchSize':decode,'seconds':time.perf_counter()-start,'freeBytesBefore':free,'freeBytesAfter':torch.cuda.mem_get_info(device)[0]})
            for part,wave in zip(group,validated):
                sf.write(folder/f'segment-{index+1:03}.wav',wave,rate,subtype='FLOAT');_,play=assemble([wave],rate);target=folder/f'play-{index:03}.wav';temporary=folder/f'play-{index:03}.tmp.wav';sf.write(temporary,play,rate,subtype='PCM_16');temporary.replace(target)
                info={'index':index,'text':part,'audioSeconds':len(wave)/rate,'sampleRate':rate,'channels':2,'readySeconds':time.perf_counter()-started};published.append(info);waves.append(wave);emit(info);index+=1
    raw,play=assemble(waves,48000);sf.write(folder/'original.wav',raw,48000,subtype='FLOAT');sf.write(folder/'speech.wav',play,48000,subtype='PCM_16')
    report={'status':'complete','model':'MOSS-TTS-Nano','mode':'first-two-then-three-sentences','requestedBatchSize':size,'segments':published,'batches':batches,'preparedText':text,'totalSeconds':time.perf_counter()-started,'firstSegmentReadySeconds':published[0]['readySeconds'],'audioSeconds':len(play)/48000,'sampleRate':48000,'channels':2,'freeGPUBytes':torch.cuda.mem_get_info(device)[0],'voiceReference':{'sha256':digest},'listeningQuality':'unverified','languageStatus':'supported' if request.get('language','English')=='English' else 'experimental-unsupported'}
    report['sentenceCount']=len(segments)
    report['PyTorchPeakAllocatedBytes']=torch.cuda.max_memory_allocated(device);report['memoryScope']='Peak is Nano process only; global headroom and benchmark nvidia-smi include other GPU users.'
    report['RTF']=report['totalSeconds']/report['audioSeconds'];(folder/'report.json').write_text(json.dumps(report,indent=2));return report
