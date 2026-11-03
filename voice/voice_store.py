"""Atomic activation and validation of Buddy's locally generated voice."""
import hashlib
import json
import uuid
from pathlib import Path
from text_audio import validate

PROMPT = 'Hello, I am Buddy. We can take this one step at a time. I am here to listen and help you feel heard.'
SETTINGS = dict(seed=42, maxFrames=4096, audioTemperature=1.0, audioTopP=.95,
                audioTopK=50, repetitionPenalty=1.0)

class VoiceStore:
    def __init__(self, root):
        self.root = Path(root)
        self.active = self.root / 'buddy'

    def read(self):
        import soundfile as sf
        try:
            meta = json.loads((self.active/'metadata.json').read_text(encoding='utf-8'))
            path = self.active/'sample.wav'
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if meta.get('version') != 1 or meta.get('sha256') != digest:
                raise ValueError('Voice metadata or checksum mismatch.')
            wave, rate = sf.read(path, dtype='float32', always_2d=True)
            wave = validate(wave, rate)
            if rate != 48000 or wave.shape[1] != 2 or not 1 <= len(wave)/rate <= 30:
                raise ValueError('Unexpected voice sample format/duration.')
            return wave, rate, meta
        except Exception as exc:
            raise ValueError('Saved Buddy voice is invalid; it was not replaced. Inspect voices/buddy. '+str(exc)) from exc

    def ensure(self, synthesize, progress=lambda message: None):
        import soundfile as sf
        if self.active.exists():
            progress('Loading saved Buddy voice')
            return self.read()
        progress('Preparing Buddy voice for the first time')
        self.root.mkdir(parents=True, exist_ok=True)
        pending = self.root/('.pending-'+uuid.uuid4().hex)
        pending.mkdir()
        wave, rate, _ = synthesize(PROMPT, 'English')
        wave = validate(wave, rate)
        if rate != 48000 or wave.shape[1] != 2 or not 1 <= len(wave)/rate <= 30:
            raise ValueError('Initial Buddy voice sample failed validation; no voice activated.')
        path = pending/'sample.wav'
        sf.write(path, wave, rate, subtype='FLOAT')
        meta = dict(version=1, origin='MOSS-generated; no supplied recording', prompt=PROMPT,
                    settings=SETTINGS, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        (pending/'metadata.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
        # The directory becomes visible as a voice only after both files are complete.
        # An interrupted staging directory is never treated as an active voice.
        try:
            pending.rename(self.active)
        except FileExistsError:
            pass  # Another local process activated the voice first; use that identity.
        return self.read()
