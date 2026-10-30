/** Safe offline configuration for local production build / route type generation. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const command = process.argv[2] ?? 'build';
if (!['build', 'typegen', 'start', 'dev'].includes(command)) throw new Error('Unsupported operation');
const env = { ...process.env, NODE_ENV: command === 'dev' ? 'development' : 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://unavailable-supabase.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-unavailable-publishable-key',
  NEXT_PUBLIC_API_BASE_URL: 'https://unavailable-api.invalid/api/v1',
  NEXT_PUBLIC_DATA_ADAPTER: 'http', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
  NEXT_DIST_DIR: process.argv[3] ?? '.next-qa' };
const args = [require.resolve('next/dist/bin/next'), command];
if (command === 'start') args.push('--hostname', '127.0.0.1', '--port', '3102');
if (command === 'dev') args.push('--hostname', '127.0.0.1', '--port', '3103');
const result = spawnSync(process.execPath, args, { cwd: new URL('..', import.meta.url), env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
