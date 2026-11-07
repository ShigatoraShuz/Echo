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
