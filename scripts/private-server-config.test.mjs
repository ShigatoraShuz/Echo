import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateGatewayEnvironment } from './private-server-config.mjs';

test('ordinary local startup keeps its original environment', () => {
  assert.deepEqual(privateGatewayEnvironment(undefined), {});
});
test('the exact private origin is approved and only the local gateway is trusted', () => {
  assert.deepEqual(privateGatewayEnvironment('https://echo.example.ts.net/api/v1/'), {
    FRONTEND_URL: 'https://echo.example.ts.net',
    NEXT_PUBLIC_API_BASE_URL: 'https://echo.example.ts.net/api/v1',
    TRUSTED_PROXY_ADDRESSES: '127.0.0.1,::1',
  });
});
test('insecure, public, credential-bearing and unexpected addresses fail closed', () => {
  for (const url of [
    'http://echo.example.ts.net/api/v1', 'https://example.com/api/v1',
    'https://echo.ts.net.attacker.example/api/v1', 'https://user:secret@echo.example.ts.net/api/v1',
    'https://echo.example.ts.net:8443/api/v1', 'https://echo.example.ts.net/api/v1?x=1',
    'https://echo.example.ts.net/api/v1#fragment', 'https://echo.example.ts.net/other',
  ]) assert.throws(() => privateGatewayEnvironment(url));
});
