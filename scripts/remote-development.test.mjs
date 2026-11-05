import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remoteDevelopmentEnvironment } from './remote-development.mjs';
test('local mode preserves existing configuration',()=>assert.deepEqual(remoteDevelopmentEnvironment(undefined),{}));
test('remote mode scopes origin and trusts only the loopback proxy',()=>{
  assert.deepEqual(remoteDevelopmentEnvironment('https://echo.example.test/api/v1/'),{
    NEXT_PUBLIC_API_BASE_URL:'https://echo.example.test/api/v1',
    FRONTEND_URL:'https://echo.example.test',
    TRUSTED_PROXY_ADDRESSES:'127.0.0.1,::1',
  });
});
test('remote configuration rejects credentials, insecure URLs and wrong paths',()=>{
  for(const url of ['http://echo.example.test/api/v1','https://user:pass@echo.example.test/api/v1','https://echo.example.test/','https://echo.example.test/api/v1?q=1','https://echo.example.test/api/v1#x'])
    assert.throws(()=>remoteDevelopmentEnvironment(url));
});
