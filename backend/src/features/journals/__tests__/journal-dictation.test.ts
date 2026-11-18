import {it,expect,vi} from 'vitest';
import {JournalDictation} from '../journal-dictation.js';
import {journalPhq8Reading,phq8ReadingLabel,phq8Severity} from '@echo/contracts';

it('isolates dictation jobs and calls only Whisper operations without Buddy consent',async()=>{
 const calls:any[]=[];const service=new JournalDictation(()=>({dictation:vi.fn(async(value:any)=>{calls.push(value);return value.task==='transcribe'?{text:'A fictional reflection.'}:{};})}) as any);
 try{
  const job=await service.create('owner');await vi.waitFor(()=>expect(service.status('owner',job.id).state).toBe('prepared'));
  expect(()=>service.status('other',job.id)).toThrow();
  await expect(service.submit('other',job.id,Buffer.from('sample'))).rejects.toThrow();
  await service.submit('owner',job.id,Buffer.from('sample'));await vi.waitFor(()=>expect(service.status('owner',job.id).state).toBe('complete'));
  expect(service.result('owner',job.id)).toMatchObject({text:'A fictional reflection.'});
  await vi.waitFor(()=>expect(calls.map(x=>x.task)).toEqual(['warm_whisper','transcribe','close']));
  expect(calls[1].audio).toBe(Buffer.from('sample').toString('base64'));
  expect(()=>service.result('owner',job.id)).toThrow();
 }finally{await service.close();}
});
it('cancels preparation without reviving an expired operation',async()=>{
 let finish!:()=>void;const calls:string[]=[];
 const service=new JournalDictation(()=>({dictation:async(p:any)=>{calls.push(p.task);if(p.task==='warm_whisper')await new Promise<void>(resolve=>finish=resolve);return {};}}) as any);
 try{const job=await service.create('owner');await service.cancel('owner',job.id);finish();await Promise.resolve();expect(()=>service.status('owner',job.id)).toThrow();expect(calls).toContain('close');}finally{await service.close();}
});
it.each([[0,'minimal'],[4,'minimal'],[5,'mild'],[9,'mild'],[10,'moderate'],[14,'moderate'],[15,'moderately_severe'],[19,'moderately_severe'],[20,'severe'],[24,'severe']] as const)('retains PHQ8 threshold %i -> %s',(score,band)=>expect(phq8Severity(score)).toBe(band));
it('represents partial estimates as bounds rather than completed scores',()=>{
 const range=journalPhq8Reading({status:'available',coverage:3,subtotal:6,total:null});
 expect(range).toMatchObject({kind:'partial',lower:6,upper:21,lowerSeverity:'mild',upperSeverity:'severe'});
 expect(phq8ReadingLabel(range)).toBe('Partial estimate: mild to severe');
 expect(phq8ReadingLabel(journalPhq8Reading({status:'available',coverage:7,subtotal:10,total:null}))).toBe('Partial estimate: moderate');
 expect(journalPhq8Reading({status:'available',coverage:8,subtotal:0,total:0})).toEqual({kind:'complete',score:0,severity:'minimal'});
 for(const status of ['failed','unavailable','available'])expect(journalPhq8Reading({status,coverage:0,subtotal:null,total:null})).toEqual({kind:'unavailable'});
 expect(journalPhq8Reading({status:'available',coverage:1,subtotal:5,total:null})).toEqual({kind:'unavailable'});
});
