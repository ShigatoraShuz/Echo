import {readFileSync, existsSync} from 'node:fs';
export function loadNativeSettings(file, databaseUrl) {
  if (!existsSync(file)) throw Error('Missing backend/.local-development/native-runtime.json. Set projectRef to the configured Supabase project, userIds to 1-20 intended test-account UUIDs (Authentication > Users > User UID), and createdAfter to an initial ISO UTC activation timestamp. Keep createdAfter stable across restarts. No services started. See docs/setup/INTEGRATED_MODELS.md.');
  let settings;
  try { settings = JSON.parse(readFileSync(file, 'utf8')); }
  catch { throw Error('Invalid native-runtime.json: expected valid JSON. Existing credentials were not changed.'); }
  const database = new URL(databaseUrl);
  if (!settings || database.origin !== `https://${settings.projectRef}.supabase.co` || database.username || database.password)
    throw Error('Native development project mismatch: projectRef must match the configured SUPABASE_URL.');
  if (!Array.isArray(settings.userIds) || settings.userIds.length < 1 || settings.userIds.length > 20 || settings.userIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))
    throw Error('Native development requires 1-20 explicit test-account UUIDs in userIds. Use Authentication > Users > User UID.');
  if (!settings.createdAfter || Number.isNaN(Date.parse(settings.createdAfter)))
    throw Error('Native development requires a valid createdAfter activation timestamp. Set it once and keep it stable.');
  return settings;
}
