/** Actual local HTTP inference, synthetic inputs, no database connections. */
import { verifyLocalFlow } from "./verify-local-json-flow.mts";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { CoreClient } from "../src/infrastructure/analysis/core-client.js";
import { journalAnalysisResultSchema } from "@echo/contracts";

const probe=net.createServer().listen(0,'127.0.0.1');await once(probe,'listening');
const address=probe.address();assert.ok(address && typeof address!=='string');
await new Promise<void>(resolve=>probe.close(()=>resolve()));
const url=`http://127.0.0.1:${address.port}`;
const token='synthetic-http-service-token-at-least-32-characters';
const cache=fileURLToPath(new URL('../../../runtime-cache/http-validation/',import.meta.url));
await mkdir(cache,{recursive:true});
const python=process.env.ECHO_PYTHON ?? 'E:/Python Project/PROJECTS/Thesis2/Thesis2_VENV/python.exe';
const child=spawn(python,['-B','-m','uvicorn','app.main:app','--host','127.0.0.1','--port',String(address.port),'--workers','1'],{
  cwd:new URL('../../ai-service/',import.meta.url),env:{...process.env,CORE_MODELS_ENABLED:'true',WORKER_ENABLED:'false',AI_SERVICE_TOKEN:token,
    MODELS_ROOT:fileURLToPath(new URL('../../../models/',import.meta.url)),HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_DATASETS_OFFLINE:'1',HF_HOME:cache,HF_HUB_CACHE:cache+'/hub',HF_XET_CACHE:cache+'/xet'},stdio:['ignore','pipe','pipe'],
});
const output:string[]=[];child.stdout.on('data',v=>output.push(String(v)));child.stderr.on('data',v=>output.push(String(v)));
try {
  const client=new CoreClient(url,token);const deadline=Date.now()+600_000;
  while (!await client.ready()) {
    if (child.exitCode!==null || Date.now()>deadline) throw new Error('Core service startup failed: '+output.join('').slice(-3000));
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  const missing=await fetch(url+'/v2/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Synthetic'})});
  assert.equal(missing.status,401);
  const invalid=await fetch(url+'/v2/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({text:''})});
  assert.equal(invalid.status,422);
  const started=Date.now();
  const response=await fetch(url+'/v2/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({text:'I enjoyed lunch with a friend.',language:'en'}),signal:AbortSignal.timeout(180_000)});
  assert.equal(response.status,200);const result=journalAnalysisResultSchema.parse(await response.json());
  const analysisMs=Date.now()-started;
  const chatStarted=Date.now();const chat=process.env.ECHO_VERIFY_PHQ_ONLY==='true'?null:await client.chat([{role:'user',content:'I feel stressed about schoolwork. Can you help me choose one small next step?'}]);
  if(chat){assert.equal(chat.supportRequired,false);assert.ok(chat.reply?.trim());}
  const metrics=await (await fetch(url+'/v2/runtime',{headers:{Authorization:'Bearer '+token}})).json();
  assert.ok(metrics.residentModelCount<=1);assert.ok(metrics.peakAllocatedBytes<16*1024**3);
  await writeFile(new URL('../../../integration-backup/core-http-result.json',import.meta.url),JSON.stringify({result,chat,metrics,analysisMs,chatMs:Date.now()-chatStarted,authRejected:missing.status,emptyRejected:invalid.status,scope:'actual loopback FastAPI and Express CoreClient; synthetic input; no database'},null,2));
  if(process.env.ECHO_VERIFY_LOCAL_JSON==='true')await verifyLocalFlow(client);
  console.info('PASS authenticated local HTTP analysis and Buddy client using copied models');
} finally {
  if (child.exitCode === null && child.signalCode === null) { child.kill();await once(child,'exit'); }
  await writeFile(new URL('../../../integration-backup/core-http-server.log',import.meta.url),output.join(''));
}
