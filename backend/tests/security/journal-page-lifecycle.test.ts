import {it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {JournalService} from '../../src/features/journals/journals.service.js';
import {LocalAnalysisStore} from '../../src/infrastructure/analysis/local-analysis-store.js';
import fixture from '../../../packages/contracts/fixtures/core-v2.json';
async function scenario(run:(s:any,store:LocalAnalysisStore,core:any,user:string)=>Promise<void>){
 const root=mkdtempSync(join(tmpdir(),'echo-journal-page-'));const store=new LocalAnalysisStore(root);
 const core={journalRuntime:vi.fn().mockResolvedValue({ready:true}),ready:async()=>true,talkBusy:async()=>false,classify:vi.fn().mockResolvedValue({suicidal_language_flag:false}),analyze:vi.fn().mockResolvedValue(fixture)};
 const service:any=new JournalService({} as any,{} as any,{} as any,undefined,undefined,undefined,undefined,undefined,store,core as any);
 service.hasGlobalAnalysisConsent=async()=>true;service.hasGlobalFacialConsent=async()=>false;service.assertAnalysisGates=async()=>{};service.get=async()=>({body:'Synthetic reflection'});
 vi.stubEnv('ECHO_PAGE_MODEL_LEASES','true');
 await store.ready;try{await run(service,store,core,randomUUID());}finally{await service.closeModelLeases();await store.close();vi.unstubAllEnvs();rmSync(root,{recursive:true,force:true});}
}
it('does not recover saved journal work while the page is absent; entry resumes it',async()=>scenario(async(s,store,core,user)=>{
 const job=await store.create(user,randomUUID(),'a','a');await s.recoverLocalJobs();await s.localTail;
 expect(store.get(user,job.id)?.waitReason).toBe('page_inactive');expect(core.analyze).not.toHaveBeenCalled();
 const lease=await s.acquireModelLease(user,'session','tab');await s.journalLeases.settled();expect(lease.profile).toBe('journal');
 await s.recoverLocalJobs();await s.localTail;expect(store.get(user,job.id)?.status).toBe('completed');expect(store.get(user,job.id)?.waitReason).toBeUndefined();
 expect(core.journalRuntime.mock.calls.some((call:any[])=>call[0]==='prepare')).toBe(true);
 expect(core.classify.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
}));
it('one Journal tab leaving does not unload the other; final exit unloads and pauses work',async()=>scenario(async(s,store,core,user)=>{
 const a=await s.acquireModelLease(user,'session','a'),b=await s.acquireModelLease(user,'session','b');await s.journalLeases.settled();
 s.releaseModelLease(user,'session',a.id);await s.journalLeases.settled();expect(core.journalRuntime.mock.calls.some((c:any[])=>c[0]==='unload')).toBe(false);
 s.releaseModelLease(user,'session',b.id);await s.journalLeases.settled();expect(core.journalRuntime.mock.calls.some((c:any[])=>c[0]==='unload')).toBe(false);
 const deadline=Date.parse(s.journalLeases.releaseStatus.releaseAt);const clock=s.journalLeases.now;s.journalLeases.now=()=>deadline;s.journalLeases.sweep();await s.journalLeases.settled();s.journalLeases.now=clock;
 expect(core.journalRuntime.mock.calls.some((c:any[])=>c[0]==='unload')).toBe(true);
 const job=await store.create(user,randomUUID(),'b','b');await s.processLocal(job);expect(store.get(user,job.id)?.waitReason).toBe('page_inactive');expect(core.analyze).not.toHaveBeenCalled();
}));
it('an account leaving cannot complete a late result while another account keeps Journal open',async()=>scenario(async(s,store,core,user)=>{
 const a=await s.acquireModelLease(user,'s1','a');const other=randomUUID();await s.acquireModelLease(other,'s2','b');await s.journalLeases.settled();
 let finish!:(v:any)=>void;let started!:()=>void;const startedPromise=new Promise<void>(r=>started=r);
 core.analyze.mockImplementation(()=>{started();return new Promise(r=>finish=r);});
 const job=await store.create(user,randomUUID(),'c','c');const pending=s.processLocal(job);await startedPromise;
 s.releaseModelLease(user,'s1',a.id);await s.journalLeases.settled();finish(fixture);await pending;
 expect(store.get(user,job.id)?.status).toBe('waiting_for_provider');expect(store.get(user,job.id)?.waitReason).toBe('page_inactive');expect(store.get(user,job.id)?.result_ciphertext).toBeNull();
 const owners=core.journalRuntime.mock.calls.filter((c:any[])=>c[0]==='owners').at(-1)[1];expect(owners).toHaveLength(1);
}));
it('rechecks consent before a page-restored job runs',async()=>scenario(async(s,store,core,user)=>{
 const job=await store.create(user,randomUUID(),'d','d');await s.processLocal(job);
 await s.acquireModelLease(user,'session','tab');await s.journalLeases.settled();s.hasGlobalAnalysisConsent=async()=>false;
 await s.recoverLocalJobs();await s.localTail;expect(store.get(user,job.id)?.status).toBe('failed');expect(core.analyze).not.toHaveBeenCalled();
}));
