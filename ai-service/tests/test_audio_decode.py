import io
import numpy as np
import pytest
sf=pytest.importorskip("soundfile")
from app.speech_worker import decode_recording

def wav(seconds):
 buffer=io.BytesIO();sf.write(buffer,np.zeros((seconds*16000,2),dtype=np.float32),16000,format='WAV');return buffer.getvalue()

def test_audio_duration_and_formats_are_bounded():
 assert len(decode_recording(wav(1)))>15000
 with pytest.raises(Exception):decode_recording(b'not an audio file')
 with pytest.raises(ValueError):decode_recording(b'x'*(10*1024*1024+1))
 with pytest.raises(ValueError):decode_recording(wav(61))
