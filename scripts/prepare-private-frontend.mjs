import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

// Build once per frontend/config revision, keeping ordinary npm run dev unchanged.
export function preparePrivateFrontend(root, environment) {
  const frontend = path.join(root, 'frontend');
  const env = { ...environment, NODE_ENV: 'production', NEXT_DIST_DIR: '.next-private', NEXT_PUBLIC_ENABLE_FACIAL_ANALYSIS: 'true' };
  const stamp = path.join(frontend, '.next-private/echo-build-fingerprint');
  const fingerprint = () => {
    const hash = createHash('sha256');
    const add = file => {
      if (!existsSync(file)) return;
      hash.update(path.relative(root, file)); hash.update(readFileSync(file));
    };
    const walk = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file); else if (entry.isFile()) add(file);
      }
    };
    for (const directory of ['src', 'public', 'assets']) walk(path.join(frontend, directory));
    for (const file of ['next.config.ts', 'tsconfig.json', 'package.json', 'postcss.config.mjs', 'postcss.config.js', 'tailwind.config.ts', '.env', '.env.local', '.env.production', '.env.production.local']) add(path.join(frontend, file));
    walk(path.join(root, 'packages/contracts/dist'));
    for (const file of ['package-lock.json', 'scripts/prepare-private-frontend.mjs']) add(path.join(root, file));
    hash.update(JSON.stringify(Object.entries(env).filter(([key]) => key.startsWith('NEXT_PUBLIC_') || ['GATEWAY_API_BASE_URL', 'ECHO_REMOTE_API_BASE_URL', 'NEXT_DIST_DIR'].includes(key)).sort()));
    return hash.digest('hex');
  };
  if (existsSync(stamp) && existsSync(path.join(frontend, '.next-private/BUILD_ID')) && readFileSync(stamp, 'utf8') === fingerprint()) {
    console.log('Reusing the verified prebuilt private frontend.'); return;
  }
  console.log('Preparing the optimized private frontend; subsequent page visits need no development compilation.');
  const require = createRequire(import.meta.url);
  const build = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], { cwd: frontend, env, stdio: 'inherit', windowsHide: true });
  if (build.status !== 0) throw Error('Private frontend build failed. Fix the build or use -DevelopmentUI for the existing development frontend.');
  writeFileSync(stamp, fingerprint());
}
