import tempfile,unittest,types
from pathlib import Path
import numpy as np
import soundfile as sf
from wav_io import WavAudio
class WavTests(unittest.TestCase):
    def setUp(self):
        root=Path(__file__).resolve().parent/'work/tests';root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.path=Path(self.temp.name)/'sample.wav';self.original=types.SimpleNamespace(functional=object());self.io=WavAudio(self.original)
    def tearDown(self):self.temp.cleanup()
    def test_stereo_roundtrip(self):
        import torch
        wave=torch.stack([torch.linspace(-.5,.5,4800),torch.linspace(.25,-.25,4800)])
        self.io.save(self.path,wave,48000);restored,rate=self.io.load(self.path)
        self.assertEqual(rate,48000);np.testing.assert_array_equal(restored.numpy(),wave.numpy());self.assertEqual(sf.info(self.path).subtype,'FLOAT')
    def test_mono(self):
        sf.write(self.path,np.ones(1000)*.1,16000);wave,rate=self.io.load(self.path);self.assertEqual(tuple(wave.shape),(1,1000));self.assertEqual(rate,16000)
    def test_resampler_preserved(self):self.assertIs(self.io.functional,self.original.functional)
    def test_bad_wave(self):
        with self.assertRaises(ValueError):self.io.save(self.path,np.ones((4,100)),48000)
        with self.assertRaises(ValueError):self.io.save(self.path,np.array([[np.nan]]),48000)
    def test_saved_buddy(self):
        path=Path(__file__).resolve().parent/'voices/buddy/sample.wav';wave,rate=self.io.load(path);self.assertEqual(rate,48000);self.assertEqual(wave.shape[0],2)
if __name__=='__main__':unittest.main()
