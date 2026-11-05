import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {JournalService} from '../../src/features/journals/journals.service.js';
const input=(overrides:any={})=>({submissionKey:randomUUID(),draftIntent:'create',expectedSubmissionKey:null,title:'Saved title',body:'Saved body',emotions:[],tags:[],privacyStatus:'private',analysisConsent:false,...overrides});
function setup(){
 const rows=new Map<string,any>();
 const table=()=>{
  let mode='read',payload:any,filters:Array<[string,any]>=[];
  const execute=async()=>{
   if(mode==='insert'){
    if(rows.has(payload.user_id))return {data:null,error:{code:'23505'}};
    const row={...payload,id:randomUUID()};rows.set(payload.user_id,row);return {data:{...row},error:null};
   }
   const row=[...rows.values()].find(r=>filters.every(([key,value])=>r[key]===value));
   if(!row)return {data:null,error:null};
   if(mode==='update')Object.assign(row,payload);
   if(mode==='delete')rows.delete(row.user_id);
   return {data:{...row},error:null};
  };
  const q:any={insert:(data:any)=>{mode='insert';payload=data;return q;},update:(data:any)=>{mode='update';payload=data;return q;},delete:()=>{mode='delete';return q;},select:()=>q,
   eq:(key:string,value:any)=>{filters.push([key,value]);return q;},is:(key:string,value:any)=>{filters.push([key,value]);return q;},single:execute,maybeSingle:execute};return q;
 };
 const service:any=Object.create(JournalService.prototype);service.database={schema:()=>({from:table})};
 service.encryptJournal=(v:any)=>({ciphertext:Buffer.from(JSON.stringify({title:v.title,body:v.body})).toString('base64'),iv:'AA==',authenticationTag:'AA==',keyVersion:1});
 service.toDraftResponse=(row:any)=>({...JSON.parse(Buffer.from(String(row.content_ciphertext).slice(2),'hex').toString()),id:row.id,submission_key:row.submission_key,emotions:row.emotions,tags:row.tags,privacy_status:row.privacy_status,analysis_consent:row.analysis_consent,updated_at:row.updated_at});
 return {service,rows};
}
it('new draft creation cannot overwrite an existing saved draft',async()=>{
 const {service,rows}=setup();const old=input();await service.saveDraft('owner',old);
 await expect(service.saveDraft('owner',input({body:'New text'}))).rejects.toThrow(/already exists|changed/);
 expect((await service.getDraft('owner')).body).toBe(old.body);expect(rows.size).toBe(1);
});
it('only one of two stale-tab updates succeeds',async()=>{
 const {service}=setup();const old=input();await service.saveDraft('owner',old);
 const a=input({draftIntent:'update',expectedSubmissionKey:old.submissionKey,body:'First tab'});
 const b=input({draftIntent:'update',expectedSubmissionKey:old.submissionKey,body:'Second tab'});
 const results=await Promise.allSettled([service.saveDraft('owner',a),service.saveDraft('owner',b)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await service.getDraft('owner')).body).toBe('First tab');
});
it('an acknowledged identity can be replayed without creating or changing another draft',async()=>{
 const {service,rows}=setup();const draft=input();const first=await service.saveDraft('owner',draft);const replay=await service.saveDraft('owner',draft);
 expect(replay.id).toBe(first.id);expect(rows.size).toBe(1);
 await expect(service.saveDraft('owner',{...draft,body:'Changed retry'})).rejects.toThrow();
});
it('a successful update can be retried after a lost acknowledgement',async()=>{
 const {service}=setup();const draft=input();await service.saveDraft('owner',draft);
 const update=input({draftIntent:'update',expectedSubmissionKey:draft.submissionKey,body:'Updated'});
 await service.saveDraft('owner',update);expect((await service.saveDraft('owner',update)).body).toBe('Updated');
});
it('cannot change content while reusing the same version key',async()=>{
 const {service}=setup();const draft=input();await service.saveDraft('owner',draft);
 await expect(service.saveDraft('owner',{...draft,draftIntent:'update',expectedSubmissionKey:draft.submissionKey,body:'Unsafe'})).rejects.toThrow(/identity/);
 expect((await service.getDraft('owner')).body).toBe(draft.body);
});
it('guarded discard rejects a stale tab and preserves newer writing',async()=>{
 const {service}=setup();const draft=input();const row=await service.saveDraft('owner',draft);
 const newer=input({draftIntent:'update',expectedSubmissionKey:draft.submissionKey,body:'Keep me'});await service.saveDraft('owner',newer);
 await expect(service.deleteDraft('owner',undefined,{id:row.id,key:draft.submissionKey})).rejects.toThrow(/changed/);
 expect((await service.getDraft('owner')).body).toBe('Keep me');
 await service.deleteDraft('owner',undefined,{id:row.id,key:newer.submissionKey});expect(await service.getDraft('owner')).toBeNull();
});
it('draft updates and discard remain account-scoped',async()=>{
 const {service}=setup();const draft=input();const row=await service.saveDraft('owner',draft);
 await expect(service.saveDraft('other',input({draftIntent:'update',expectedSubmissionKey:draft.submissionKey}))).rejects.toThrow();
 await expect(service.deleteDraft('other',undefined,{id:row.id,key:draft.submissionKey})).rejects.toThrow();expect((await service.getDraft('owner')).body).toBe(draft.body);
});

it('legacy null-key drafts can be explicitly resumed and safely versioned',async()=>{
 const {service}=setup();const legacy=input({submissionKey:null});await service.saveDraft('owner',legacy);
 const updated=input({draftIntent:'update',expectedSubmissionKey:null,body:'Explicit legacy edit'});
 expect((await service.saveDraft('owner',updated)).submission_key).toBe(updated.submissionKey);
 await expect(service.saveDraft('owner',input({draftIntent:'update',expectedSubmissionKey:null}))).rejects.toThrow();
 expect((await service.getDraft('owner')).body).toBe('Explicit legacy edit');
});
it('legacy null-key discard requires the exact saved draft record',async()=>{
 const {service}=setup();const row=await service.saveDraft('owner',input({submissionKey:null}));
 await expect(service.deleteDraft('owner',undefined,{id:randomUUID(),key:null})).rejects.toThrow();
 expect(await service.getDraft('owner')).not.toBeNull();
 await service.deleteDraft('owner',undefined,{id:row.id,key:null});expect(await service.getDraft('owner')).toBeNull();
});
