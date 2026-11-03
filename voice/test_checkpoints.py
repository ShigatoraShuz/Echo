import json,tempfile,unittest
from pathlib import Path
from checkpoints import validate_checkpoint
class CheckpointTests(unittest.TestCase):
    def setUp(self):
        root=Path(__file__).resolve().parent/'work/tests';root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.root=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()
    def test_config_only_rejected(self):
        (self.root/'config.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'No loadable'):validate_checkpoint(self.root)
    def test_bin_accepted(self):
        (self.root/'pytorch_model.bin').write_bytes(b'x'*2048);validate_checkpoint(self.root)
    def test_missing_shard_rejected(self):
        (self.root/'model.safetensors.index.json').write_text(json.dumps({'weight_map':{'weight':'part.safetensors'}}))
        with self.assertRaises(ValueError):validate_checkpoint(self.root)
    def test_shards_accepted(self):
        (self.root/'model.safetensors.index.json').write_text(json.dumps({'weight_map':{'weight':'part.safetensors'}}));(self.root/'part.safetensors').write_bytes(b'x'*2048);validate_checkpoint(self.root)
    def test_lfs_rejected(self):
        (self.root/'pytorch_model.bin').write_bytes(b'version https://git-lfs.github.com/spec/'+b'x'*2048)
        with self.assertRaisesRegex(ValueError,'LFS pointer'):validate_checkpoint(self.root)
if __name__=='__main__':unittest.main()
