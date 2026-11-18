"""Qualify this checkout's rebuilt MOSS artifacts using synthetic speech tests."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def main():
    config = json.loads((ROOT / 'backend/.local-development/buddy-runtime.json').read_text('utf-8-sig'))
    manifest = Path(config['mossRoot']) / 'manifest.json'
    lock_path = ROOT / 'ai-service/app/buddy/moss-native.lock.json'
    lock = json.loads(lock_path.read_text('utf-8'))
    inventory = json.loads(manifest.read_text('utf-8'))
    for key in ('modelRevision', 'codecRevision', 'forkRevision', 'sourceArchiveSHA256'):
        if inventory[key] != lock[key]:
            raise ValueError(f'MOSS pinned identity differs: {key}')
    lock['manifestSHA256'] = hashlib.sha256(manifest.read_bytes()).hexdigest()
    lock['syntheticInferenceValidated'] = False
    lock_path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    env = dict(os.environ)
    for key, name in [('cbtPython','BUDDY_CBT_PYTHON'),('nanoPython','BUDDY_NANO_PYTHON'),('whisperPython','BUDDY_WHISPER_PYTHON'),('mossPython','BUDDY_MOSS_PYTHON'),('mossRoot','BUDDY_MOSS_NATIVE_ROOT')]:
        env[name] = config[key]
    report_dir = ROOT / 'runtime-cache/buddy-audit'
    report_dir.mkdir(parents=True, exist_ok=True)
    env.update(ECHO_MOSS_NATIVE_VALIDATE='1', ECHO_TEST_REPORT_DIR=str(report_dir))
    for test, report in [('smoke_native_expressive.py','native-expressive-test.json'), ('smoke_startup_expressive.py','startup-expressive-test.json')]:
        subprocess.run([config['mossPython'], '-B', str(ROOT / 'ai-service/tests' / test)], cwd=ROOT, env=env, check=True)
        if not json.loads((report_dir / report).read_text('utf-8'))['passed']:
            raise ValueError(f'MOSS validation failed: {test}')
    lock['syntheticInferenceValidated'] = True
    lock_path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    print('Expressive MOSS synthetic inference and startup residency validated.', flush=True)

if __name__ == '__main__':
    main()
