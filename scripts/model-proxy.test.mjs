import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parse } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('tsx/cjs');
const { default: config } = require('../frontend/next.config.ts');
const { proxyRequest } = require('next/dist/server/lib/router-utils/proxy-request.js');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = server => `http://127.0.0.1:${server.address().port}`;

test('model rewrite survives a response beyond the default 30-second proxy timeout', { timeout: 45_000 }, async t => {
  assert.ok(config.experimental.proxyTimeout >= 600_000);
  assert.ok(config.experimental.proxyTimeout <= 900_000);
  const upstream = http.createServer((_req, res) => {
    setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end('{"modelReady":true}'); }, 31_000);
  });
  await listen(upstream);
  const proxy = http.createServer((req, res) => {
    proxyRequest(req, res, parse(origin(upstream) + '/model'), undefined, undefined, config.experimental.proxyTimeout)
      .catch(() => { if (!res.headersSent) res.writeHead(502); res.end(); });
  });
  t.after(() => { proxy.closeAllConnections(); proxy.close(); upstream.closeAllConnections(); upstream.close(); });
  await listen(proxy);
  const response = await fetch(origin(proxy) + '/api/v1/buddy/messages', { signal: AbortSignal.timeout(40_000) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { modelReady: true });
});
