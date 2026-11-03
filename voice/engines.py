import os
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',HF_HOME=str(ROOT/'cache/huggingface'),HF_MODULES_CACHE=str(ROOT/'cache/modules'),TORCHINDUCTOR_CACHE_DIR=str(ROOT/'cache/torchinductor'),CUDA_CACHE_PATH=str(ROOT/'cache/cuda'))
VOICE_ROOT=Path('E:/Python Project/CODEX/models/voice')
class Engines:
    def __init__(self):self.name=None;self.models=None;self.reference_codes=None;self.voice_metadata=None
    def close(self):
        self.models=None;self.name=None;self.reference_codes=None;self.voice_metadata=None
        import gc,torch
        gc.collect()
        if torch.cuda.is_available():torch.cuda.empty_cache()
    def load(self,name='MOSS'):
        if name != 'MOSS':raise ValueError('Only MOSS is supported.')
        if self.name==name:return
        self.close()
        import torch
        torch.set_num_threads(min(4,os.cpu_count() or 1))
        if name=='MOSS':
            if not torch.cuda.is_available():raise RuntimeError('MOSS requires a CUDA GPU; no CPU fallback is configured.')
            from transformers import AutoModel
            from transformers.dynamic_module_utils import get_class_from_dynamic_module
            from transformers.processing_utils import ProcessorMixin
            base=get_class_from_dynamic_module('processing_moss_tts.MossTTSLocalProcessor',str(VOICE_ROOT/'moss'),local_files_only=True)
            class Compat(base):
                def __init__(self,tokenizer,audio_tokenizer=None,model_config=None,**kwargs):
                    ProcessorMixin.__init__(self,tokenizer=tokenizer)
                    self.tokenizer,self.audio_tokenizer,self.model_config=tokenizer,audio_tokenizer,model_config
                    for key in ('audio_user_slot_token','audio_assistant_slot_token','audio_start_token','audio_end_token'):setattr(self,key,tokenizer.convert_ids_to_tokens(int(getattr(model_config,key+'_id'))))
            processor=Compat.from_pretrained(VOICE_ROOT/'moss',codec_path=str(VOICE_ROOT/'audio-tokenizer'),local_files_only=True,trust_remote_code=True,codec_weight_dtype='bf16',codec_compute_dtype='bf16')
            processor.audio_tokenizer.to('cuda')
            model=AutoModel.from_pretrained(VOICE_ROOT/'moss',local_files_only=True,trust_remote_code=True,dtype=torch.bfloat16,attn_implementation='sdpa').to('cuda').eval()
            self.models=processor,model
        else:raise ValueError('Unknown model.')
        self.name=name
    def ensure_voice(self,progress=lambda message:None):
        if self.reference_codes is not None:return self.voice_metadata
        import torch
        from voice_store import VoiceStore
        torch.manual_seed(42)
        wave,rate,meta=VoiceStore(ROOT/'voices').ensure(self._synthesize,progress)
        progress('Encoding saved Buddy voice')
        with torch.inference_mode():
            codes=self.models[0].encode_audios_from_wav(torch.from_numpy(wave.T.copy()),rate)
        if len(codes)!=1:raise ValueError('Expected one voice reference encoding.')
        self.reference_codes=codes[0];self.voice_metadata=meta
        return meta
    def synthesize(self,text,language):
        if self.reference_codes is None:raise RuntimeError('Buddy voice must be prepared before synthesis.')
        return self._synthesize(text,language,self.reference_codes)
    def _synthesize(self,text,language,reference=None):
        import torch
        processor,model=self.models
        options={'text':text}
        if reference is not None:options['reference']=[reference]
        if language!='Taglish':options['language']='Tagalog' if language=='Filipino' else 'English'
        batch=processor([[processor.build_user_message(**options)]],mode='generation')
        with torch.inference_mode():result=model.generate(input_ids=batch['input_ids'].to('cuda'),attention_mask=batch['attention_mask'].to('cuda'),max_new_frames=4096)
        counts=[len(ids)-int(prefix)-1 for prefix,ids in result]
        if any(n>=4096 for n in counts):raise RuntimeError('MOSS exhausted its frame budget; response is incomplete.')
        audio=[w for message in processor.decode(result) if message is not None for w in message.audio_codes_list]
        if len(audio)!=1:raise RuntimeError('Expected one decoded MOSS segment.')
        wave=audio[0].detach().float().cpu().numpy()
        if wave.ndim==2:
            if wave.shape[0] not in (1,2):raise ValueError('Unexpected MOSS channel layout.')
            wave=wave.T
        return wave,int(processor.model_config.sampling_rate),{'generatedFrames':counts[0],'frameBudget':4096}
