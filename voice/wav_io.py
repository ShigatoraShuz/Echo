"""Scoped Nano WAV I/O adapter; no TorchCodec/FFmpeg or upstream file edits."""
import sys
from pathlib import Path

class WavAudio:
    def __init__(self,original):self.original=original
    def __getattr__(self,name):return getattr(self.original,name)
    def load(self,path,**kwargs):
        import soundfile as sf
        import torch
        import numpy as np
        if kwargs:raise ValueError('Unsupported WAV reader options.')
        if Path(path).suffix.lower()!='.wav':raise ValueError('Buddy reference must be a WAV file.')
        wave,rate=sf.read(path,dtype='float32',always_2d=True)
        if not wave.size or not np.isfinite(wave).all():raise ValueError('Invalid reference waveform.')
        return torch.from_numpy(wave.T.copy()),rate
    def save(self,path,wave,sample_rate,**kwargs):
        import soundfile as sf
        import torch
        import numpy as np
        if kwargs:raise ValueError('Unsupported WAV writer options.')
        if Path(path).suffix.lower()!='.wav':raise ValueError('Buddy output must be a WAV file.')
        if torch.is_tensor(wave):wave=wave.detach().float().cpu().numpy()
        wave=np.asarray(wave)
        if wave.ndim==1:wave=wave[None,:]
        if wave.ndim!=2 or wave.shape[0] not in (1,2) or not wave.size or not np.isfinite(wave).all():raise ValueError('Invalid output waveform.')
        sf.write(path,wave.T,int(sample_rate),subtype='FLOAT')

def install_wav_io(model):
    module=sys.modules[type(model).__module__]
    if not hasattr(module,'torchaudio'):raise RuntimeError('Nano audio interface changed; cannot install WAV adapter.')
    if not isinstance(module.torchaudio,WavAudio):module.torchaudio=WavAudio(module.torchaudio)
