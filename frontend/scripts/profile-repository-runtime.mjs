/** Repeatable production React probes: synthetic loopback data, fixed 150ms RPC, 3 samples per viewport/theme. */
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
process.chdir(path.join(root, 'frontend'));
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const dir = path.join(root, 'artifacts/repository-audit');
await fs.mkdir(dir, { recursive: true });
const configFile = path.join(root, 'frontend/e2e/vite.audit.config.ts');
const outDir = path.join(root, 'tmp/repository-audit/runtime-' + phase);
await build({ configFile, build: { outDir } });
const server = await preview({ configFile, build: { outDir } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (let sample = 0; sample < 3; sample++) {
    for (const screen of ['dashboard', 'calendar', 'notifications']) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('echo-theme:v1', JSON.stringify({ variant: 'echo-calm', mode: theme, motion: 'system' }));
        const nativeSet = window.setTimeout.bind(window), nativeClear = window.clearTimeout.bind(window);
        window.__auditTimers = new Set();
        window.setTimeout = (handler, delay, ...args) => {
          let timer;
          timer = nativeSet(() => { window.__auditTimers.delete(timer); if (typeof handler === 'function') handler(...args); }, delay);
          if (delay === 30000) window.__auditTimers.add(timer);
          return timer;
        };
        window.clearTimeout = timer => { window.__auditTimers.delete(timer); nativeClear(timer); };
      }, theme);
      const page = await context.newPage();
      const calls = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:3104') return route.abort();
        if (url.pathname === '/__api-probe') return route.fulfill({ json: { success: true, data: {} } });
        if (url.pathname !== '/__fixtures/rpc') return route.continue();
        const { method, args } = route.request().postDataJSON(); calls.push(method);
        await new Promise(resolve => setTimeout(resolve, 150));
        let json;
        if (method === 'dashboard') json = { success: true, data: { userProfile: { name: 'Fictional ' + args[0] } } };
        else if (method === 'calendar') json = [];
        else if (method === 'appointments') json = { appointments: [] };
        else if (method === 'journals') json = { success: true, data: { entries: [], pagination: { totalPages: 1 } } };
        else if (method === 'userNotifications') json = { notifications: [], unreadCount: 0, nextCursor: null };
        else if (method === 'settings') json = { notifications: { inAppEnabled: true } };
        else throw new Error('Unexpected fixture: ' + method);
        return route.fulfill({ json });
      });
      const started = performance.now();
      await page.goto('http://127.0.0.1:3104/' + (screen === 'notifications' ? '__qa/user-notifications' : screen));
      if (screen === 'dashboard') await page.locator('output[data-ready="true"]').waitFor();
      else if (screen === 'calendar') await page.getByText(/0 reflections.*0 saved items/).waitFor();
      else await page.waitForFunction(() => document.querySelector('button[aria-haspopup="dialog"]')?.getAttribute('disabled') === null);
      // Notification actor readiness can precede the inbox's response.
      await page.waitForTimeout(200);
      const initialMs = performance.now() - started, initialCalls = [...calls];
      let actionMs = null, actionCalls = [];
      if (screen === 'dashboard') {
        calls.length = 0; const action = performance.now();
        await page.getByRole('button', { name: 'Change range' }).click();
        await page.getByText('Fictional 30d').waitFor();
        actionMs = performance.now() - action; await page.waitForTimeout(30); actionCalls = [...calls];
        calls.length = 0;
        await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('echo:analysis-completed')); });
        await page.waitForTimeout(220);
      } else if (screen === 'calendar') {
        calls.length = 0;
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(220);
      } else {
        calls.length = 0;
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(220);
      }
      const refreshCalls = [...calls];
      await page.evaluate(() => window.auditRequests());
      const retainedDeadlines = await page.evaluate(() => window.__auditTimers.size);
      if (errors.length) throw new Error(JSON.stringify(errors));
      results.push({ screen, width, theme, sample, initialMs, initialCalls, actionMs, actionCalls, refreshCalls, retainedDeadlines, heapBytes: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null) });
      await context.close();
    }
  }
  const files = await fs.readdir(path.join(outDir, 'assets'));
  const assets = await Promise.all(files.map(async name => ({ name, bytes: (await fs.stat(path.join(outDir, 'assets', name))).size })));
  await fs.writeFile(path.join(dir, `runtime-${phase}.json`), JSON.stringify({ conditions: 'production React, Edge, fixed 150ms synthetic RPC, 200ms readiness settling, three samples per width/theme; dashboard is an actual hook probe, calendar/notifications are actual components; heap snapshots are noisy', results, assets }, null, 2));
  console.log(JSON.stringify({ phase, observations: results.length, assets: assets.length }));
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
