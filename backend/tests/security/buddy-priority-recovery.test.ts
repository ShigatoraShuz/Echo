import {it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalAnalysisStore} from '../../src/infrastructure/analysis/local-analysis-store.js';
import {JournalService} from '../../src/features/journals/journals.service.js';
import fixture from '../../../packages/contracts/fixtures/core-v2.json';

it('resumes waiting journal jobs after Buddy releases ownership and does not run completed jobs again',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-buddy-priority-'));const store=new LocalAnalysisStore(dir);const user=randomUUID();
 let busy=true,analyzed=0;
 const core={ready:async()=>true,talkBusy:async()=>busy,classify:async()=>({suicidal_language_flag:false}),analyze:async()=>{analyzed++;return fixture;}};
 const service:any=new JournalService({} as any,{} as any,{} as any,undefined,undefined,undefined,undefined,undefined,store,core as any);
 service.hasGlobalAnalysisConsent=async()=>true;service.assertAnalysisGates=async()=>{};service.get=async()=>({body:'Synthetic reflection'});
 try{
  const job=store.create(user,randomUUID(),'priority','priority');await service.processLocal(job);
  expect(store.get(user,job.id)?.status).toBe('waiting_for_provider');expect(analyzed).toBe(0);
  busy=false;await service.recoverLocalJobs();await service.localTail;
  expect(store.get(user,job.id)?.status).toBe('completed');expect(analyzed).toBe(1);
  await service.recoverLocalJobs();await service.localTail;expect(analyzed).toBe(1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

it('rechecks consent when a waiting journal resumes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-buddy-consent-'));const store=new LocalAnalysisStore(dir);const user=randomUUID();
 let busy=true,consent=true,analyzed=0;
 const core={ready:async()=>true,talkBusy:async()=>busy,classify:async()=>({suicidal_language_flag:false}),analyze:async()=>{analyzed++;return fixture;}};
 const service:any=new JournalService({} as any,{} as any,{} as any,undefined,undefined,undefined,undefined,undefined,store,core as any);
 service.hasGlobalAnalysisConsent=async()=>consent;service.assertAnalysisGates=async()=>{};service.get=async()=>({body:'Synthetic reflection'});
 try{
  const job=store.create(user,randomUUID(),'consent','consent');await service.processLocal(job);
  busy=false;consent=false;await service.recoverLocalJobs();await service.localTail;
  expect(store.get(user,job.id)?.status).toBe('failed');expect(analyzed).toBe(0);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
