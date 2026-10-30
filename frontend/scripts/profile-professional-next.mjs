/** Unauthenticated real Next smoke/timing. Safe build/start configuration required. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'production';
if (!['production', 'development'].includes(mode)) throw new Error('Invalid mode');
const origin = 'http://127.0.0.1:' + (mode === 'production' ? 3102 : 3103);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const result = { mode, authenticated: false, externalRequestsBlocked: true, login: [], guards: [], bundles: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (let sample = 0; sample < 4; sample++) {
    const start = performance.now();
    await page.goto(origin + '/professional/login?error=login_required', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Professional sign in', exact: true }).waitFor();
    const usefulMs = performance.now() - start;
    const timing = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return { ttfbMs: n.responseStart - n.startTime, domContentLoadedMs: n.domContentLoadedEventEnd - n.startTime };
    });
    result.login.push({ sample, label: sample === 0 ? 'first server route request' : 'subsequent document request', usefulMs, ...timing });
  }
  if (mode === 'production') {
    for (const route of ['/professional', '/professional/requests', '/professional/my-cases', '/professional/calendar', '/professional/resources', '/professional/settings', '/professional/cases/fe000000-0000-4000-8000-000000000001', '/dev/professional-preview']) {
      const response = await context.request.get(origin + route, { maxRedirects: 0 });
      result.guards.push({ route, status: response.status(), location: response.headers().location ?? null, cacheControl: response.headers()['cache-control'] ?? null });
      if (route.startsWith('/professional') && ![303, 307, 308].includes(response.status())) throw new Error('Protected route did not redirect: ' + route);
      if (route.startsWith('/dev/') && response.status() !== 404) throw new Error('Preview is not excluded');
    }
    const root = path.resolve('frontend/.next');
    const manifests = JSON.parse(await fs.readFile(path.join(root, 'server/app-paths-manifest.json'), 'utf8'));
    for (const [route, file] of Object.entries(manifests).filter(([route]) => route.includes('/professional/(workspace)/'))) {
      const manifest = path.join(root, 'server', file.replace(/\.js$/, '_client-reference-manifest.js'));
      const scope = {}; vm.runInNewContext(await fs.readFile(manifest, 'utf8'), scope, { timeout: 1000 });
      const data = Object.values(scope.__RSC_MANIFEST)[0];
      const pageEntry = Object.entries(data.entryJSFiles).find(([name]) => name.endsWith(route.replace(/\/page$/, '/page')));
      const chunks = pageEntry?.[1] ?? [];
      let bytes = 0, gzipBytes = 0;
      for (const chunk of new Set(chunks)) { const content = await fs.readFile(path.join(root, chunk)); bytes += content.length; gzipBytes += gzipSync(content).length; }
      result.bundles.push({ route, definition: 'unique page entry JS chunks including shared layouts, before HTTP compression; excludes runtime/bootstrap/lazy chunks', chunks: [...new Set(chunks)].length, bytes, gzipBytes });
    }
  }
  await context.close();
} finally { await browser.close(); }
await fs.writeFile('artifacts/professional-performance/next-' + mode + '-current.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
