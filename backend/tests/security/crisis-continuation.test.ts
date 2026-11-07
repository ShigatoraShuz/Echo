import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {LocalAnalysisStore} from '../../src/infrastructure/analysis/local-analysis-store.js';
it('continues only an owned blocked job and retains explicit acknowledgement history',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-confirm-'));const store=new LocalAnalysisStore(dir);const user=randomUUID(),journal=randomUUID(),other=randomUUID(),key=randomUUID();
 await store.ready;try{const job=await store.create(user,journal,'request','hash');await store.set(user,job.id,'safety_action_required',10);
 await expect(store.confirmContinuation(other,job.id,key)).rejects.toThrow();expect(store.get(user,job.id)?.status).toBe('safety_action_required');
 expect(await store.confirmContinuation(user,job.id,key)).toEqual({status:'queued'});
 expect(await store.confirmContinuation(user,job.id,key)).toEqual({status:'queued'});
 await expect(store.confirmContinuation(user,job.id,randomUUID())).rejects.toThrow();
 const record=JSON.parse(readFileSync(join(dir,user,'analysis',job.id+'.json'),'utf8'));
 expect(record.userContinuation).toMatchObject({confirmedBy:user,originalStatus:'safety_action_required',kind:'user_requested_continuation',checklistCompleted:true});expect(record.reviewer).toBeUndefined();
 }finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});

it('acknowledgements are account-scoped and do not acknowledge later detections',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-crisis-'));const store=new LocalAnalysisStore(dir);const owner=randomUUID(),other=randomUUID(),first=randomUUID(),later=randomUUID();
 try{await store.acknowledgeCrisis(owner,first,randomUUID());expect(await store.crisisAcknowledged(owner,first)).toBe(true);expect(await store.crisisAcknowledged(other,first)).toBe(false);expect(await store.crisisAcknowledged(owner,later)).toBe(false);}finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});
