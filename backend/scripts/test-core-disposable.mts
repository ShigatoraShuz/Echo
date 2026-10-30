/** Synthetic HTTP worker + real isolated PostgreSQL migrations; never connects to Supabase. */
import { createDisposableDatabase } from "./disposable-database.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { LocalWorkerService } from "../src/features/analysis/local-worker.service.js";
import { createEncryptionService } from "../src/infrastructure/encryption/encryption.service.js";
import { sealAnalysisResult, openAnalysisResult } from "../src/infrastructure/encryption/analysis-result-encryption.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../src/features/journals/journals.service.js";
import { journalAnalysisResultSchema } from "@echo/contracts";

const database=await createDisposableDatabase();
const fixture=await readFile(new URL("../../supabase/tests/database/journal-analysis-transactions.test.sql",import.meta.url),"utf8");
await database.exec(fixture.slice(0,fixture.indexOf("create temp table test_jobs"))+"commit;");
await database.exec("insert into ai_analysis.worker_health(worker_id,accepting_jobs,last_heartbeat_at) values('local-worker',true,now());");
const submission=await database.query(`select * from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',true,'queued',null,'local_worker','v1','native-synthetic-hmac','native-synthetic-request')`);
const jobId=submission.rows[0].analysis_job_id;
const journalId=submission.rows[0].journal_id;
const encryption=createEncryptionService(Buffer.alloc(32,8).toString('base64'),1);
const traces: string[]=[];
const sqlClient={schema(schema: string){
  assert.equal(schema,'ai_analysis');
  return {
    async rpc(name: string,args:Record<string,unknown>={}){
      assert.match(name,/^[a-z_]+$/);traces.push(name);
      try {
        const entries=Object.entries(args);const sql=entries.map(([key],i)=>`${key} => $${i+1}${['p_payload','p_result'].includes(key)?'::jsonb':''}`).join(',');
        const values=entries.map(([,v])=>v && typeof v==='object'?JSON.stringify(v):v);
        const result=await database.query(`select ai_analysis.${name}(${sql}) as value`,values);
        return {data:result.rows[0]?.value,error:null};
      }catch(e){return {data:null,error:{message:(e as Error).message}};}
    },
    from(table:string){
      assert.ok(['worker_health','analysis_requests'].includes(table));
      const filters:string[]=[];const values:unknown[]=[];let columns='*';let limit='';
      const query={
        select(value:string){assert.match(value,/^[a-z_,]+$/);columns=value;return query;},
        in(key:string,list:unknown[]){assert.match(key,/^[a-z_]+$/);values.push(list);filters.push(`${key}=any($${values.length})`);return query;},
        is(key:string,value:null){assert.equal(value,null);assert.match(key,/^[a-z_]+$/);filters.push(`${key} is null`);return query;},
        limit(value:number){limit=`limit ${Number(value)}`;return query;},
        async upsert(row:Record<string,unknown>){
          const keys=Object.keys(row);assert.ok(keys.every(k=>/^[a-z_]+$/.test(k)));
          await database.query(`insert into ai_analysis.worker_health(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) on conflict(worker_id) do update set ${keys.filter(k=>k!=='worker_id').map(k=>`${k}=excluded.${k}`).join(',')}`,Object.values(row).map(v=>typeof v==='object'?JSON.stringify(v):v));
          return {error:null};
        },
        then(resolve:(v:unknown)=>unknown,reject:(v:unknown)=>unknown){return database.query(`select ${columns} from ai_analysis.${table} ${filters.length?'where '+filters.join(' and '):''} ${limit}`,values).then(r=>resolve({data:r.rows,error:null}),reject);},
      };return query;
    },
  };
}};
const journals={
  async get(user:string,id:string){assert.equal(user,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');assert.equal(id,journalId);return {body:'I enjoyed lunch with a friend and a quiet walk.'};},
  encryptAnalysisResult(result:unknown){return sealAnalysisResult(result,encryption);},
};
const service=new LocalWorkerService(sqlClient as unknown as SupabaseClient,journals as unknown as JournalService,'synthetic-local-worker-token-32-characters');
const app=createApp({v1:{localWorker:{service}}});
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const address=server.address();assert.ok(address && typeof address!=='string');
let code:number|null=null;
try {
  const python=process.env.ECHO_PYTHON ?? 'E:/Python Project/PROJECTS/Thesis2/Thesis2_VENV/python.exe';
  const child=spawn(python,['-B','tests/run_worker_once.py'],{cwd:new URL('../../ai-service/',import.meta.url),env:{...process.env,PYTHONPATH:'.',BACKEND_URL:`http://127.0.0.1:${address.port}/api/v1/internal/ai`,AI_WORKER_TOKEN:'synthetic-local-worker-token-32-characters',ECHO_SECURITY_CONTROLS_FILE:''},stdio:['ignore','pipe','pipe']});
  const output:string[]=[];child.stdout.on('data',v=>output.push(String(v)));child.stderr.on('data',v=>output.push(String(v)));
  const timer=setTimeout(()=>child.kill(),300_000);
  [code]=await once(child,'exit');clearTimeout(timer);
  assert.equal(code,0,output.join('').slice(-4000));
  const rows=await database.query('select schema_version,severity,phq8_score,result_payload from ai_analysis.analysis_results where analysis_request_id=$1',[jobId]);
  assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].severity,null);assert.equal(rows.rows[0].phq8_score,null);
  const result=journalAnalysisResultSchema.parse(openAnalysisResult(rows.rows[0].result_payload,encryption));
  const projection=await database.query('select status,progress from public.analysis_status_projection where job_id=$1',[jobId]);
  assert.equal(projection.rows[0].status,'completed');assert.equal(projection.rows[0].progress,100);
  await writeFile(new URL('../../../integration-backup/disposable-core-result.json',import.meta.url),JSON.stringify({scope:'isolated PostgreSQL/WASM + actual HTTP worker, no Supabase connection',projection:projection.rows[0],result,traces},null,2));
  console.info('PASS copied models -> HTTP worker -> PostgreSQL callbacks -> encrypted v2 result -> completed projection');
} finally {server.close();await database.close();}
