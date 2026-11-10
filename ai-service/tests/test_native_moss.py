"""Native speech preflight and transport invariants; no GPU/assets required."""
from pathlib import Path
import pytest
from app.buddy.loading import safe_progress,retryable


def test_missing_expressive_assets_fail_clearly_without_fallback(tmp_path,monkeypatch):
 from app.buddy.native_moss import NativeMoss
 monkeypatch.setenv('BUDDY_MOSS_NATIVE_ROOT',str(tmp_path))
 with pytest.raises(RuntimeError,match='BUDDY_MOSS_ASSET_MISSING'):NativeMoss()
 assert list(tmp_path.iterdir())==[]


def test_expressive_progress_is_allowlisted_and_no_private_fields_escape():
 value=safe_progress({'component':'moss','state':'loading','attempt':1,'prompt':'private','path':'private'})
 assert value=={'component':'moss','state':'loading','attempt':1,'maxAttempts':5}
 assert not retryable('BUDDY_MOSS_AUDIO_INCOMPLETE')
 assert not retryable('BUDDY_MOSS_MANIFEST_INTEGRITY_FAILED')


def test_setup_patch_provides_memory_io_and_rejects_partial_speech():
 source=(Path(__file__).parents[2]/'scripts/setup-moss-native.py').read_text(encoding='utf-8')
 assert 'std::cin' in source and 'std::cout' in source and 'ECHO_REQUIRE_COMPLETE' in source
 adapter=(Path(__file__).parents[1]/'app/buddy/native_moss.py').read_text(encoding='utf-8')
 assert "'--text-file','-'" in adapter and "'--wav-out','-'" in adapter
 assert "process.stdin.write(text.encode('utf-8'))" in adapter
 assert "'--text',text" not in adapter


def test_native_patch_bounds_input_indices_and_is_idempotent(tmp_path):
 import importlib.util
 setup=Path(__file__).parents[2]/'scripts/setup-moss-native.py'
 spec=importlib.util.spec_from_file_location('moss_setup_test',setup)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 context=tmp_path/'src/llama-context.cpp';context.parent.mkdir()
 context.write_text('    if (output_ids.size() < (size_t) n_outputs_max) {\n        output_ids.resize(n_outputs_max);\n    }\n            output_ids[out_id] = i;',encoding='utf-8')
 entry=tmp_path/'tools/tts/run-moss-tts-delay.cpp';entry.parent.mkdir(parents=True)
 entry.write_text('// ECHO_MEMORY_IO ECHO_REQUIRE_COMPLETE',encoding='utf-8')
 module.patch(tmp_path)
 patched=context.read_text(encoding='utf-8')
 assert 'std::max<int64_t>(n_outputs_max, cparams.n_batch)' in patched
 assert 'GGML_ASSERT(out_id >= 0 && (size_t) out_id < output_ids.size())' in patched
 module.patch(tmp_path)
 assert context.read_text(encoding='utf-8')==patched
 assert module.CODEC_REV=='3cd226ba2947efa357ef453bcad111b6eafba782'


def test_unqualified_native_build_cannot_be_used_by_normal_inference(tmp_path,monkeypatch):
 from app.buddy import native_moss
 source=tmp_path/'source';source.mkdir()
 (source/'moss-native.lock.json').write_text('{"syntheticInferenceValidated":false}',encoding='utf-8')
 (tmp_path/'manifest.json').write_text('{}',encoding='utf-8')
 monkeypatch.setattr(native_moss,'HERE',source)
 monkeypatch.setenv('BUDDY_MOSS_NATIVE_ROOT',str(tmp_path))
 monkeypatch.delenv('ECHO_MOSS_NATIVE_VALIDATE',raising=False)
 with pytest.raises(RuntimeError,match='BUDDY_MOSS_VALIDATION_REQUIRED'):
  native_moss.NativeMoss()


def test_native_setup_resumes_a_checkpoint_download_with_checksum(tmp_path, monkeypatch):
 import hashlib, importlib.util, io
 setup=Path(__file__).parents[2]/'scripts/setup-moss-native.py'
 spec=importlib.util.spec_from_file_location('moss_download_test',setup)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 target=tmp_path/'model.safetensors';target.with_suffix('.safetensors.partial').write_bytes(b'first')
 class Response(io.BytesIO):
  status=206
  headers={"Content-Length":"4","Content-Range":"bytes 5-8/9"}
 def open_request(request,timeout):
  assert request.get_header('Range')=='bytes=5-33554436'
  return Response(b'last')
 monkeypatch.setattr(module.urllib.request,'urlopen',open_request)
 module.fetch('https://example.invalid/model.safetensors',target,hashlib.sha256(b'firstlast').hexdigest())
 assert target.read_bytes()==b'firstlast'
 assert not target.with_suffix('.safetensors.partial').exists()
 target.unlink();target.with_suffix('.safetensors.partial').write_bytes(b'first')
 with pytest.raises(ValueError,match='integrity'):
  module.fetch('https://example.invalid/model.safetensors',target,'0'*64)
 assert not target.exists()

 target.with_suffix('.safetensors.partial').write_bytes(b'first')
 Response.headers={"Content-Length":"8","Content-Range":"bytes 5-12/13"}
 with pytest.raises(module.http.client.IncompleteRead):
  module.fetch('https://example.invalid/model.safetensors',target,hashlib.sha256(b'firstlast').hexdigest())
 assert not target.exists()


def test_native_setup_joins_bounded_download_ranges(tmp_path, monkeypatch):
 import hashlib, importlib.util, io
 setup=Path(__file__).parents[2]/'scripts/setup-moss-native.py'
 spec=importlib.util.spec_from_file_location('moss_ranges_test',setup)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 seen=[]
 class Response(io.BytesIO):
  status=206
 def open_request(request,timeout):
  seen.append(request.get_header('Range'))
  start=0 if len(seen)==1 else 3
  response=Response(b'abc' if start==0 else b'DEF')
  response.headers={'Content-Length':'3','Content-Range':f'bytes {start}-{start+2}/6'}
  return response
 monkeypatch.setattr(module.urllib.request,'urlopen',open_request)
 target=tmp_path/'checkpoint.safetensors'
 module.fetch('https://example.invalid/checkpoint.safetensors',target,hashlib.sha256(b'abcDEF').hexdigest())
 assert target.read_bytes()==b'abcDEF'
 assert seen==['bytes=0-33554431','bytes=3-33554434']


def test_native_memory_guard_uses_nvml_without_a_torch_context(monkeypatch):
 from app.buddy import gpu_memory
 from app.core.exceptions import ModelUnavailableError
 monkeypatch.delenv('CUDA_VISIBLE_DEVICES',raising=False)
 calls=[]
 def read(identity,index,**options):
  calls.append((identity,index,options))
  return {'freeBytes':8*1024**3,'totalBytes':16*1024**3,'source':'nvml'}
 monkeypatch.setattr(gpu_memory,'_read_nvml',read)
 assert gpu_memory.native_headroom(5*1024**3)['source']=='nvml'
 assert calls==[(None,0,{'single':True})]
 with pytest.raises(ModelUnavailableError,match='HEADROOM'):gpu_memory.native_headroom(7*1024**3)
 def multiple(*args,**kwargs):raise OSError('multiple devices')
 monkeypatch.setattr(gpu_memory,'_read_nvml',multiple)
 with pytest.raises(ModelUnavailableError,match='MEMORY_UNAVAILABLE'):gpu_memory.native_headroom()
