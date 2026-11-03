import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {LocalAnalysisStore} from '../../src/infrastructure/analysis/local-analysis-store.js';
it('continues only an owned blocked job and retains explicit acknowledgement history',()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-confirm-'));const store=new LocalAnalysisStore(dir);const user=randomUUID(),journal=randomUUID(),other=randomUUID(),key=randomUUID();
 try{const job=store.create(user,journal,'request','hash');store.set(user,job.id,'safety_action_required',10);
 expect(()=>store.confirmContinuation(other,job.id,key)).toThrow();expect(store.get(user,job.id)?.status).toBe('safety_action_required');
 expect(store.confirmContinuation(user,job.id,key)).toEqual({status:'queued'});
 expect(store.confirmContinuation(user,job.id,key)).toEqual({status:'queued'});
 expect(()=>store.confirmContinuation(user,job.id,randomUUID())).toThrow();
 const record=JSON.parse(readFileSync(join(dir,user,'analysis',job.id+'.json'),'utf8'));
 expect(record.userContinuation).toMatchObject({confirmedBy:user,originalStatus:'safety_action_required',kind:'user_requested_continuation',checklistCompleted:true});expect(record.reviewer).toBeUndefined();
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

it('acknowledgements are account-scoped and do not acknowledge later detections',()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-crisis-'));const store=new LocalAnalysisStore(dir);const owner=randomUUID(),other=randomUUID(),first=randomUUID(),later=randomUUID();
 try{store.acknowledgeCrisis(owner,first,randomUUID());expect(store.crisisAcknowledged(owner,first)).toBe(true);expect(store.crisisAcknowledged(other,first)).toBe(false);expect(store.crisisAcknowledged(owner,later)).toBe(false);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
