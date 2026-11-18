import express from 'express';
import request from 'supertest';
import {it,expect,vi} from 'vitest';
import {createJournalsRouter} from '../journals.routes.js';
import {JournalDictation} from '../journal-dictation.js';
import {errorMiddleware} from '../../../shared/middleware/error.middleware.js';

it('authenticates dictation uploads and isolates polling, results, and cancellation by owner',async()=>{
 const calls:any[]=[];const dictation=new JournalDictation(()=>({dictation:async(p:any)=>{calls.push(p);return p.task==='transcribe'?{text:'Dictated words.'}:{};}}) as any);
 const verifier={getUser:vi.fn(async(token:string)=>({id:token==='owner'?'owner-id':'other-id',emailVerified:true}))};
 const app=express();app.use(express.json());app.use(createJournalsRouter({dictation} as any,verifier as any,{assertAiAccess:vi.fn()} as any));app.use(errorMiddleware);
 try{
  expect((await request(app).post('/journals/dictation/jobs').send({})).status).toBe(401);
  const created=await request(app).post('/journals/dictation/jobs').set('Authorization','Bearer owner').send({});expect(created.status).toBe(202);const id=created.body.data.id,path='/journals/dictation/jobs/'+id;
  expect((await request(app).get(path).set('Authorization','Bearer other')).status).toBe(404);
  expect((await request(app).delete(path).set('Authorization','Bearer other')).status).toBe(200);
  expect((await request(app).get(path).set('Authorization','Bearer owner')).body.data.state).toBe('prepared');
  expect((await request(app).post(path+'/audio').set('Authorization','Bearer other').set('Content-Type','application/octet-stream').send(Buffer.from('audio'))).status).toBe(404);
  expect((await request(app).post(path+'/audio').set('Authorization','Bearer owner').set('Content-Type','application/octet-stream').send(Buffer.from('audio'))).status).toBe(202);
  await vi.waitFor(()=>expect(dictation.status('owner-id',id).state).toBe('complete'));
  expect((await request(app).get(path+'/result').set('Authorization','Bearer other')).status).toBe(404);
  const result=await request(app).get(path+'/result').set('Authorization','Bearer owner');expect(result.body.data.text).toBe('Dictated words.');expect(result.headers['cache-control']).toBe('no-store');
  expect(calls.every(p=>['warm_whisper','transcribe','close'].includes(p.task))).toBe(true);
 }finally{await dictation.close();}
});
it('rejects empty and oversized uploads before transcription',async()=>{
 const dictation={submit:vi.fn()};const app=express();app.use(express.json());app.use(createJournalsRouter({dictation} as any,{getUser:async()=>({id:'owner',emailVerified:true})} as any,{assertAiAccess:vi.fn()} as any));app.use(errorMiddleware);
 const path='/journals/dictation/jobs/10000000-0000-4000-8000-000000000001/audio';
 expect((await request(app).post(path).set('Authorization','Bearer owner').set('Content-Type','application/octet-stream').send(Buffer.alloc(0))).status).toBe(422);
 expect((await request(app).post(path).set('Authorization','Bearer owner').set('Content-Type','application/octet-stream').send(Buffer.alloc(10*1024*1024+1))).status).toBe(413);
 expect(dictation.submit).not.toHaveBeenCalled();
});
