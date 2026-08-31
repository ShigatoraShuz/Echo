// Deliberately does not import server.js: startup maintenance can mutate the database.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { LocalWorkerService } from '../../backend/dist/features/analysis/local-worker.service.js';
const requireBackend=createRequire(new URL('../../backend/package.json',import.meta.url));
const {createClient}=requireBackend('@supabase/supabase-js');
const url=process.env.SUPABASE_URL;
if(new URL(url).hostname!=='lruciislmmqvcwweqjop.supabase.co')throw new Error('Unexpected QA database target');
const database=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anonymous=createClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const report={recordedAt:new Date().toISOString(),scope:'Read-only PostgREST/service checks; no inference, no journal reads, no writes',checks:[]};
for(const table of ['journals','journal_drafts']){
 const all=await database.schema('journal_service').from(table).select('*',{count:'exact',head:true});
 const pending=await database.schema('journal_service').from(table).select('*',{count:'exact',head:true}).neq('title','[encrypted]');
 report.checks.push({check:`${table}: ciphertext sentinel coverage`,status:all.error||pending.error?'BLOCKED':pending.count?'NEEDS_BACKFILL':'PASS',total:all.count,pendingLegacyTitle:pending.count,errorCode:all.error?.code??pending.error?.code??null});
}
const protocol=new LocalWorkerService(database,{},'qa-only-unused-auth-secret-never-sent');
try{report.checks.push({check:'External-worker protocol read-only storage health',status:'PASS',result:await protocol.protocolHealth()})}catch{report.checks.push({check:'External-worker protocol read-only storage health',status:'FAIL'})}
const cleanup=await database.schema('ai_analysis').rpc('run_retention',{p_dry_run:true});
report.checks.push({check:'Retention dry run through PostgREST',status:cleanup.error?'FAIL':'PASS',result:cleanup.data,errorCode:cleanup.error?.code??null});
const privateAccess=await anonymous.schema('ai_analysis').from('analysis_requests').select('id',{head:true,count:'exact'});
report.checks.push({check:'Anonymous private job access denied',status:privateAccess.error?'PASS':'FAIL',httpStatus:privateAccess.status,errorCode:privateAccess.error?.code??null});
const statusAccess=await anonymous.from('analysis_status_projection').select('job_id',{head:true,count:'exact'});
report.checks.push({check:'Anonymous public status access denied',status:statusAccess.error?'PASS':'FAIL',httpStatus:statusAccess.status,errorCode:statusAccess.error?.code??null});
await writeFile(new URL('backend-readonly-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
