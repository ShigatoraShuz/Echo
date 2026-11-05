import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkCoreTransport} from './check-core-transport.mjs';
const token='synthetic-private-test-token';
test('authenticated preparation check does not warm models',async()=>{
 await checkCoreTransport('http://127.0.0.1:8002',token,async(url,options)=>{
  assert.equal(url.pathname,'/v2/preparation');assert.equal(options.method,undefined);
  assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.redirect,'error');
  return Response.json({preparation:{state:'loading'}});
 });
});
for(const [status,code] of [[401,'AUTH_FAILED'],[403,'AUTH_FAILED'],[429,'RATE_LIMITED'],[503,'UNAVAILABLE']])
 test('rejects '+status+' without exposing response content',async()=>{
  await assert.rejects(checkCoreTransport('http://127.0.0.1:8002',token,async()=>new Response('private-path-and-token',{status})),e=>e.message.includes(code)&&!e.message.includes('private-path-and-token')&&!e.message.includes(token));
 });
test('connection and contract failures have safe diagnostics',async()=>{
 await assert.rejects(checkCoreTransport('http://127.0.0.1:8002',token,async()=>{throw Error(token);}),/CONNECTION_FAILED/);
 await assert.rejects(checkCoreTransport('http://127.0.0.1:8002',token,async()=>Response.json({secret:token})),/INVALID_RESPONSE/);
});
