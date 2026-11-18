import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const fields = {
  corePython: 'ECHO_MODEL_PYTHON',
  cbtPython: 'BUDDY_CBT_PYTHON',
  nanoPython: 'BUDDY_NANO_PYTHON',
  whisperPython: 'BUDDY_WHISPER_PYTHON',
  mossPython: 'BUDDY_MOSS_PYTHON',
  mossRoot: 'BUDDY_MOSS_NATIVE_ROOT',
};

/** Load machine-local interpreter paths without publishing them in source control. */
export function loadBuddyRuntimeEnvironment(root) {
  const configPath = path.join(root, 'backend/.local-development/buddy-runtime.json');
  if (!existsSync(configPath)) return {};
  const value = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  if (value.schemaVersion !== 1) throw Error('Unsupported local Buddy runtime configuration.');
  const environment = {};
  for (const [key, name] of Object.entries(fields)) {
    const configured = value[key];
    if (typeof configured !== 'string' || !path.isAbsolute(configured) || !existsSync(configured)) {
      throw Error(`Local Buddy runtime path is unavailable: ${key}`);
    }
    environment[name] = path.resolve(configured);
  }
  return environment;
}
