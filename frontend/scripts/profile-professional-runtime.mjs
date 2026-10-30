/** Production React profiling harness; synthetic loopback RPC only. No auth credentials. */
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { fixtures, caseId } from '../e2e/fixtures.ts';
const phase = process.argv[2] ?? 'current';
if (!/^[\w-]+$/.test(phase)) throw new Error('Invalid output label');
const onlyTheme = process.env.ECHO_PERF_THEME;
if (onlyTheme && !['light', 'dark'].includes(onlyTheme)) throw new Error('Invalid theme filter');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const width of [1440, 390]) for (const theme of onlyTheme ? [onlyTheme] : ['light', 'dark']) for (const delay of [0, 150]) for (let sample = 0; sample < 3; sample++) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme: theme });
    await context.addInitScript(theme => {
      localStorage.setItem('echo-theme:v1', JSON.stringify({ variant: 'echo-calm', mode: theme, motion: 'system' }));
      const apply = () => {
        if (!document.documentElement) return false;
        document.documentElement.classList.toggle('dark', theme === 'dark'); return true;
      };
      if (!apply()) {
        const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
        observer.observe(document, { childList: true, subtree: true });
      }
    }, theme);
    await context.addInitScript(() => {
      window.__professionalProfile = [];
      window.__perf = { longTasks: [], skeletonMs: 0, skeletonSince: null, shellsRemoved: 0 };
      new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      document.addEventListener('DOMContentLoaded', () => {
        const scan = records => {
          window.__perf.shellsRemoved += records.flatMap(r => [...r.removedNodes]).filter(n => n instanceof Element && (n.matches('.professional-portal') || n.querySelector('.professional-portal'))).length;
          const loading = [...document.querySelectorAll('[role="status"], [aria-busy="true"]')].some(n => n.getClientRects().length && (n.getAttribute('aria-busy') === 'true' || /loading|checking|opening/i.test((n.getAttribute('aria-label') ?? '') + ' ' + n.textContent)));
          if (loading && window.__perf.skeletonSince === null) window.__perf.skeletonSince = performance.now();
          if (!loading && window.__perf.skeletonSince !== null) { window.__perf.skeletonMs += performance.now() - window.__perf.skeletonSince; window.__perf.skeletonSince = null; }
        };
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy'] });
        scan([]);
      });
    });
    const page = await context.newPage();
    const state = await fixtures(page); state.paginatedQueue = true; state.detail.messagingAvailable = true;
    const calls = [], errors = []; let pending = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfinished', request => {
      const call = calls.find(c => c.request === request);
      if (call) { call.durationMs = performance.now() - call.start; pending--; }
    });
    await page.route('**/__fixtures/rpc', async route => {
      const { method } = route.request().postDataJSON();
      const call = { method, request: route.request(), start: performance.now() }; calls.push(call); pending++;
      if (delay) await sleep(delay);
      await route.fallback();
    });
    const snapshot = () => page.evaluate(() => ({ ...window.__perf, skeletonMs: window.__perf.skeletonMs + (window.__perf.skeletonSince === null ? 0 : performance.now() - window.__perf.skeletonSince), commits: window.__professionalProfile.length, renderMs: window.__professionalProfile.reduce((n, e) => n + e.actualDuration, 0) }));
    const content = async kind => {
      await page.waitForFunction(kind => {
        const text = document.body.innerText;
        if (kind === 'queue') return [...document.querySelectorAll('a')].some(a => a.textContent.trim() === 'Open case' && a.getClientRects().length);
        if (kind === 'calendar') return text.includes('No upcoming appointments');
        if (kind === 'resources') return text.includes('No reviewed crisis resources are available in this response');
        if (kind === 'case') return text.includes('Fictional shared message for browser tests');
        if (kind === 'settings') return !!document.querySelector('input[autocomplete="name"], input#professional-name');
        if (kind === 'notifications') return text.includes('0 unread') && text.includes('No updates here yet');
        if (kind === 'messages') return !!document.querySelector('.pro-conversation-list button');
        if (kind === 'thread') return text.includes('Fictional private conversation');
      }, kind, { polling: 'raf' });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const measure = async (label, kind, action, cold = false) => {
      const before = cold ? { commits: 0, renderMs: 0, skeletonMs: 0, shellsRemoved: 0, longTasks: [] } : await snapshot();
      const start = performance.now(), first = calls.length;
      await action(); await content(kind); const usefulMs = performance.now() - start;
      while (pending) await sleep(10);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const settledMs = performance.now() - start;
      await sleep(25);
      const after = await snapshot();
      const actualDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (actualDark !== (theme === 'dark')) throw new Error('Echo theme did not match benchmark condition');
      results.push({ width, theme, delay, sample, label, usefulMs, settledMs,
        commits: after.commits - before.commits, renderMs: after.renderMs - before.renderMs,
        skeletonMs: after.skeletonMs - before.skeletonMs, shellsRemoved: after.shellsRemoved - before.shellsRemoved,
        actualTheme: actualDark ? 'dark' : 'light', longTaskMs: after.longTasks.slice(before.longTasks.length).reduce((n, e) => n + e.duration, 0),
        calls: calls.slice(first).map(c => ({ method: c.method, startMs: c.start - start, durationMs: c.durationMs })), errors: [...errors] });
    };
    const nav = async name => {
      if (width < 1024 && ['Resources', 'Settings'].includes(name)) {
        await page.getByRole('button', { name: 'Open workspace menu' }).click();
        await page.getByRole('dialog').getByRole('link', { name, exact: true }).click();
      } else await page.getByRole('navigation', { name: width < 1024 ? 'Professional mobile navigation' : 'Professional workspace', exact: true }).getByRole('link', { name, exact: true }).click();
    };
    await measure('cold Today', 'queue', () => page.goto('http://127.0.0.1:3101/professional?organization=org-one', { waitUntil: 'domcontentloaded' }), true);
    for (const [name, kind] of [['Requests', 'queue'], ['My cases', 'queue'], ['Calendar', 'calendar'], ['Resources', 'resources'], ['Settings', 'settings'], ['Today', 'queue']]) await measure('warm ' + name, kind, () => nav(name));
    await measure('open notifications', 'notifications', () => page.locator('button[aria-label="Notifications"]:visible').click());
    await measure('notification refresh event', 'notifications', () => page.evaluate(() => window.dispatchEvent(new Event('echo:appointments-changed'))));
    await page.keyboard.press('Escape');
    await measure('open messages', 'messages', () => page.getByRole('button', { name: 'Messages', exact: true }).click());
    await measure('open thread', 'thread', () => page.getByRole('button', { name: /Case FE000000/ }).click());
    await page.keyboard.press('Escape');
    await measure('warm View Case', 'case', () => page.getByRole('link', { name: 'Open case', exact: true }).first().click());
    await page.getByRole('link', { name: 'Request queue', exact: true }).click(); await content('queue');
    await measure('switch organization', 'queue', () => page.getByLabel('Active organization', { exact: true }).selectOption('org-two'));
    for (const [url, kind] of [['requests', 'queue'], ['my-cases', 'queue'], ['calendar', 'calendar'], ['resources', 'resources'], ['settings', 'settings'], ['cases/' + caseId, 'case']]) await measure('cold ' + url.split('/')[0], kind, () => page.goto('http://127.0.0.1:3101/professional/' + url + '?organization=org-one', { waitUntil: 'domcontentloaded' }), true);
    console.log(JSON.stringify({ width, theme, delay, sample, errors }));
    await context.close();
  }
  await fs.mkdir('artifacts/professional-performance', { recursive: true });
  if (onlyTheme) {
    const existing = JSON.parse(await fs.readFile('artifacts/professional-performance/runtime-' + phase + '.json', 'utf8'));
    results.push(...existing.results.filter(row => row.theme !== onlyTheme));
  }
  await fs.writeFile('artifacts/professional-performance/runtime-' + phase + '.json', JSON.stringify({ environment: { browser: browser.version(), mode: 'Vite optimized static build, production React profiling, actual Professional components; Next router/auth/API substituted with synthetic loopback fixtures', samples: 3, delayDescription: '0 or controlled 150ms per RPC; NOT backend/database latency', noCloud: true }, results }, null, 2));
} finally { await browser.close(); }
