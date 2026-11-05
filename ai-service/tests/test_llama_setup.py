"""Offline staging tests; dummy binaries are never executed."""
import hashlib,importlib.util,json,zipfile
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('llama_setup',Path(__file__).resolve().parents[2]/'scripts/install-llama-runtime.py');setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)

def staged(tmp_path):
 stage=tmp_path/'llama/runtime/test.staging';stage.mkdir(parents=True)
 archive=stage/'runtime.zip'
 with zipfile.ZipFile(archive,'w') as z:z.writestr('llama-server.exe',b'synthetic fixture, not executable')
 lock={'tag':'test','commit':'a'*40,'repository':'https://github.com/ggml-org/llama.cpp','assets':[{'name':'runtime.zip','sha256':setup.digest(archive)}]}
 return stage,lock

def test_runtime_is_published_only_after_checksum_and_inventory_validation(tmp_path):
 stage,lock=staged(tmp_path);target=setup.install(tmp_path,lock,True)
 assert not stage.exists() and (target/'manifest.json').is_file()
 assert setup.install(tmp_path,lock,False)==target
 (target/'bin/llama-server.exe').write_bytes(b'tampered')
 with pytest.raises(ValueError):setup.install(tmp_path,lock,False)

def test_corrupt_archive_cannot_activate_runtime(tmp_path):
 stage,lock=staged(tmp_path);(stage/'runtime.zip').write_bytes(b'partial')
 with pytest.raises(ValueError,match='checksum'):setup.install(tmp_path,lock,True)
 assert not (tmp_path/'llama/runtime/test/manifest.json').exists()

def test_normal_setup_requires_explicit_download(tmp_path):
 with pytest.raises(ValueError,match='Explicit'):setup.install(tmp_path,{'tag':'test'},False)

@pytest.mark.parametrize('name',['../escape','C:/escape','..\\escape'])
def test_archive_traversal_is_rejected(tmp_path,name):
 archive=tmp_path/'bad.zip'
 with zipfile.ZipFile(archive,'w') as z:z.writestr(name,b'bad')
 with pytest.raises(ValueError,match='Unsafe'):setup.extract(archive,tmp_path/'destination')
 assert not (tmp_path/'escape').exists()

def test_corrupt_manifest_cannot_read_arbitrary_paths(tmp_path):
 _,lock=staged(tmp_path);target=setup.install(tmp_path,lock,True);manifest=json.loads((target/'manifest.json').read_text());manifest['files'][0]['path']='../../outside'
 (target/'manifest.json').write_text(json.dumps(manifest))
 with pytest.raises(ValueError,match='Unsafe'):setup.install(tmp_path,lock,False)


def source_staged(tmp_path):
 commit='a'*40;archive=tmp_path/'llama'/(commit+'.source.zip');archive.parent.mkdir()
 with zipfile.ZipFile(archive,'w') as z:
  for name in ('convert_hf_to_gguf.py','LICENSE','gguf-py/gguf/__init__.py'):
   z.writestr('llama.cpp-'+commit+'/'+name,b'synthetic source')
 return archive,{'commit':commit,'sourceArchiveSHA256':setup.digest(archive)}


def test_source_is_verified_against_pinned_archive_on_reuse(tmp_path):
 _,lock=source_staged(tmp_path);target=setup.install_source(tmp_path,lock,True)
 assert setup.install_source(tmp_path,lock,False)==target
 (target/'convert_hf_to_gguf.py').write_bytes(b'tampered source!!')
 with pytest.raises(ValueError):setup.install_source(tmp_path,lock,False)


def test_source_corruption_prevents_activation(tmp_path):
 archive,lock=source_staged(tmp_path);archive.write_bytes(b'partial')
 with pytest.raises(ValueError,match='checksum'):setup.install_source(tmp_path,lock,True)
 assert not (tmp_path/'llama/converter'/lock['commit']).exists()


def test_source_offline_requires_explicit_activation(tmp_path):
 _,lock=source_staged(tmp_path)
 with pytest.raises(ValueError,match='Explicit'):setup.install_source(tmp_path,lock,False)


def test_source_requires_pin(tmp_path):
 with pytest.raises(ValueError,match='checksum'):setup.install_source(tmp_path,{'commit':'a'*40},True)


def test_source_rejects_invalid_commit(tmp_path):
 with pytest.raises(ValueError,match='commit'):setup.install_source(tmp_path,{'commit':'../escape'},True)


def test_source_rejects_uninventoried_code(tmp_path):
 _,lock=source_staged(tmp_path);target=setup.install_source(tmp_path,lock,True)
 (target/'injected.py').write_text('unexpected')
 with pytest.raises(ValueError,match='Unexpected'):setup.install_source(tmp_path,lock,False)
