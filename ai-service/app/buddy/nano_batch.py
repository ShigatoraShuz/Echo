"""Pinned Nano batching, adapted from the current Buddy sentence batch implementation."""
def generate(service, model, codec, prompt, tokenizer, nq, texts):
    import torch
    device = service.device
    count = len(texts)
    from app.buddy.gpu_memory import require_headroom
    require_headroom(torch, count * 1024**3)
    tts, decode = model._resolve_effective_voice_clone_batch_sizes(resolved_device=device,
        chunk_count=count, max_memory_per_sample_gb=1.0, requested_tts_max_batch_size=count,
        requested_codec_max_batch_size=count, realtime_streaming=False)
    if tts != count or decode != count:
        raise ValueError("No hidden Nano batch reduction")
    torch.manual_seed(42)
    with torch.inference_mode():
        inputs, masks = [], []
        for text in texts:
            ids, mask = model.build_inference_input_ids(text=text, text_tokenizer=tokenizer,
                mode="voice_clone", prompt_text=None, prompt_audio_codes=prompt, device=device)
            inputs.append(ids)
            masks.append(mask)
        ids, mask = model._left_pad_inference_batch(input_id_batches=inputs,
            attention_mask_batches=masks, device=device)
        tokens = model._generate_audio_token_ids_with_fallback(prompt_input_ids=ids,
            attention_mask=mask, effective_nq=nq, max_new_frames=4096, do_sample=True,
            text_temperature=1.0, text_top_p=1.0, text_top_k=50, audio_temperature=.8,
            audio_top_p=.95, audio_top_k=25, audio_repetition_penalty=1.2,
            use_kv_cache=True, resolved_device=device)
        codes = [model._trim_generated_audio_token_ids(tokens[i], effective_nq=nq) for i in range(count)]
        if any(len(code) >= 4096 for code in codes):
            raise ValueError("Frame budget exhausted; incomplete speech rejected")
        waves, rate = model._decode_audio_token_id_batch_to_waveforms(audio_tokenizer=codec,
            audio_token_id_batches=codes, target_sample_rate=48000, effective_nq=nq, resolved_device=device)
        require_headroom(torch)
        if len(waves) != count or rate != 48000:
            raise ValueError("Nano format, batch or headroom failure")
        return [wave.detach().float().cpu().numpy().T for wave in waves]

