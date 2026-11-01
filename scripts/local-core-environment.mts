/** Read-only adoption of an existing, fingerprint-matched local Echo database. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { localEnvironment, LOCAL_API } from '../backend/scripts/lib/professional-local-target.mts';

export function coreEnvironment(databaseRoot: string) {
  const local = localEnvironment(databaseRoot);
  const state = JSON.parse(readFileSync(resolve(databaseRoot, 'backend/.local-development/private.json'), 'utf8'));
  if (state.schemaVersion !== 'echo-local-development-v1' || state.fingerprint !== local.fingerprint ||
      Buffer.from(state.encryptionKey ?? '', 'base64').length !== 32 ||
      typeof state.registrationSecret !== 'string' || state.registrationSecret.length < 32)
    throw new Error('The existing local database requires its matching original private settings. No keys were changed.');
  const secret = (purpose: string) => createHmac('sha256', state.registrationSecret).update(purpose).digest('hex');
  return {
    SUPABASE_URL: LOCAL_API, SUPABASE_PUBLISHABLE_KEY: local.anonKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceKey,
    JOURNAL_ENCRYPTION_KEY_BASE64: state.encryptionKey, JOURNAL_ENCRYPTION_KEY_VERSION: '1',
    ENCRYPTION_PREVIOUS_KEYS_JSON: '{}', SIGNUP_DRAFT_SECRET: state.registrationSecret,
    IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'model-local-v1',
    IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({ 'model-local-v1': secret('model-idempotency-v1') }),
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_API, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
    NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4200/api/v1', GATEWAY_API_BASE_URL: 'http://127.0.0.1:4200/api/v1',
    FRONTEND_URL: 'http://127.0.0.1:3000', NEXT_PUBLIC_DATA_ADAPTER: 'http',
    AI_SERVICE_TOKEN: secret('native-model-service-v1'), AI_WORKER_TOKEN: secret('native-worker-v1'),
    NEXT_DIST_DIR: '.next-native-local', EMAIL_PROVIDER: 'disabled',
    PUSH_VAPID_PUBLIC_KEY: '', PUSH_VAPID_PRIVATE_KEY: '', PUSH_VAPID_SUBJECT: '',
  };
}

// Captured only by the parent launcher; never print this command's output or save it.
if (process.argv[2]) process.stdout.write(JSON.stringify(coreEnvironment(resolve(process.argv[2]))));
