import { checkCoreTransport } from './check-core-transport.mjs';
import { remoteDevelopmentEnvironment } from './remote-development.mjs';
import { loadNativeSettings } from './native-runtime-settings.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkPort, localEnvironment } from './run-local-dev.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
function launch(executable, args, cwd, env) {
  const child = spawn(executable, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
  child.once('exit', code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } });
  return child;
}
try {
  if (process.env.ECHO_MODELS_ENABLED === 'false' || process.env.AI_CORE_PROFILE === 'local_encrypted_worker') {
    launch(process.execPath, [path.join(root, 'scripts/run-local-dev.mjs'), 'all'], root, localEnvironment(process.env));
  } else {
    if (process.env.NODE_ENV === 'production') throw Error('The integrated model launcher is for local development.');
    await Promise.all([3000, 4200, 8002].map(port => checkPort(port)));
    const configured = { ...parseEnv(readFileSync(path.join(root, 'backend/.env'), 'utf8')), ...process.env };
    const python = configured.ECHO_MODEL_PYTHON || path.join(root, 'ai-service/.venv-core/Scripts/python.exe');
    const models = path.resolve(root, configured.MODELS_ROOT || 'models');
    if (!existsSync(python) || !existsSync(path.join(models, 'manifest.json'))) throw Error('Install the model bundle and ai-service/.venv-core before starting models.');
    const settingsPath = path.join(root, 'backend/.local-development/native-runtime.json');
    const localJson = process.env.ECHO_AI_LOCAL_JSON !== 'false';
    const settings = localJson ? {projectRef:'',userIds:[],createdAfter:undefined} : loadNativeSettings(settingsPath, configured.SUPABASE_URL);
    const database = new URL(configured.SUPABASE_URL);
    for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'JOURNAL_ENCRYPTION_KEY_BASE64', 'IDEMPOTENCY_HMAC_KEYS_JSON'])
      if (!configured[name]) throw Error(`Missing existing backend configuration: ${name}`);
    // These authenticate loopback services only; existing encryption keys are preserved.
    for (const name of ['serviceToken', 'workerToken']) if (!settings[name]) settings[name] = randomBytes(48).toString('base64url');
    if (!localJson) {
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
    }
    const env = localEnvironment({ ...configured,
      NODE_ENV: 'development', APP_ENV: 'development', HOST: '127.0.0.1', PORT: '4200',
      ECHO_APP_PRESENCE: 'true', NEXT_PUBLIC_APP_PRESENCE: 'true', ECHO_PAGE_MODEL_LEASES:'true', NEXT_PUBLIC_PAGE_MODEL_LEASES:'true',
      CORE_MODELS_ENABLED: 'true', CORE_TRANSPORT: 'text_memory', MODELS_ROOT: models, WORKER_ENABLED: localJson ? 'false' : 'true',
      AI_SERVICE_TOKEN: settings.serviceToken, AI_WORKER_TOKEN: settings.workerToken,
      AI_WORKER_ID: 'echo-native-development-v1', BACKEND_URL: 'http://127.0.0.1:4200/api/v1/internal/ai',
      AI_SERVICE_URL: 'http://127.0.0.1:8002', AI_CORE_PROFILE: localJson ? 'local_json' : 'hosted_encrypted_worker',
      AI_HOSTED_PROJECT_REF: settings.projectRef, AI_DEVELOPMENT_USER_IDS: settings.userIds.join(','), AI_NATIVE_CREATED_AFTER: settings.createdAfter,
      AI_ANALYSIS_MODE: localJson ? 'local_json' : 'local_worker', LOCAL_DATA_DIR: path.join(root, 'local-data'), AI_JOB_TIMEOUT_MS: '300000', ECHO_HTTP_ONLY_MODE: '1', PROFESSIONAL_EVENTS_ENABLED: 'false',
      ECHO_BUDDY_ENABLED: process.env.ECHO_BUDDY_ENABLED === 'true' ? 'true' : 'false',
      REALTIME_TALK_ENABLED: process.env.ECHO_BUDDY_ENABLED === 'true' ? 'true' : 'false', ECHO_REALTIME_TALK: 'false', NEXT_PUBLIC_REALTIME_TALK: process.env.ECHO_BUDDY_ENABLED === 'true' ? 'true' : 'false',
      ECHO_ACTIVE_MODELS: '{}', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_DATASETS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1',
      FRONTEND_URL: 'http://127.0.0.1:3000', NEXT_PUBLIC_SUPABASE_URL: configured.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured.SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_API_BASE_URL: process.env.ECHO_REMOTE_API_BASE_URL ?? 'http://127.0.0.1:4200/api/v1', GATEWAY_API_BASE_URL: 'http://127.0.0.1:4200/api/v1',
      ...remoteDevelopmentEnvironment(process.env.ECHO_REMOTE_API_BASE_URL),
    });
    // Fail before launching if the additive, service-role-only scoped RPC is absent.
    if (!localJson) {
    const probe = await fetch(`${database.origin}/rest/v1/rpc/claim_native_job`, { method: 'POST',
      headers: { apikey: configured.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${configured.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Content-Profile': 'ai_analysis' },
      body: JSON.stringify({ p_worker_id: '', p_lease_hash: '', p_user_ids: [], p_started_after: settings.createdAfter }), signal: AbortSignal.timeout(15000) });
    const result = await probe.json();
    if (result.message !== 'NATIVE_SCOPE_REQUIRED') throw Error('Scoped native worker RPC is unavailable. Apply 20261101070000_scoped_native_model_worker.sql to the configured project.');
    }
    const require = createRequire(import.meta.url);
    const build = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(root, 'packages/contracts/tsconfig.build.json')], { cwd: root, stdio: 'inherit', windowsHide: true });
    if (build.status !== 0) throw Error('Shared contracts build failed.');
    const ai = launch(python, ['-B', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8002', '--workers', '1', '--no-access-log'], path.join(root, 'ai-service'), env);
    let ready = false;
    const deadline = Date.now() + 630000;
    let nextStartupNotice = Date.now() + 15000;
    while (!stopping && ai.exitCode === null && Date.now() < deadline) {
      try { ready = (await fetch('http://127.0.0.1:8002/ready', { signal: AbortSignal.timeout(1500) })).ok; } catch {}
      if (ready) break;
      if (Date.now() >= nextStartupNotice) {
        console.log('Waiting for private AI startup: imports, CUDA and model integrity verification may take several minutes. See the preceding startup stage.');
        nextStartupNotice = Date.now() + 15000;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw Error('Model service did not initialize. Check the preceding NATIVE_STARTUP error/stage; startup is bounded to ten minutes plus service overhead.');
    await checkCoreTransport(env.AI_SERVICE_URL, env.AI_SERVICE_TOKEN);
    console.log('Private AI transport ready. Buddy base preparation runs in the background when enabled; Chat and speech readiness are reported separately. Profile: '+env.AI_CORE_PROFILE+'. Storage: '+env.LOCAL_DATA_DIR);
    launch(process.execPath, [path.join(root, 'scripts/run-local-dev.mjs'), 'all'], root, env);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; stop(); }
