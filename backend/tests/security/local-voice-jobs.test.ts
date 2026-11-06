import {describe,expect,it,vi} from 'vitest';
import {LocalVoiceJobs} from '../../src/features/experience/local-voice-jobs.js';
describe('bounded asynchronous voice operations',()=>{
 it('does not send content during preparation and rejects another account',async()=>{
  const prepare=vi.fn().mockResolvedValue({}),run=vi.fn().mockResolvedValue({text:'synthetic transcript'}),release=vi.fn().mockResolvedValue({});
  const jobs=new LocalVoiceJobs(prepare,run,release);
  try{const created=jobs.create('owner','transcribe');await Promise.resolve();await Promise.resolve();expect(run).not.toHaveBeenCalled();expect(()=>jobs.status('other',created.id)).toThrow();
   jobs.start('owner',created.id,'transcribe',{task:'transcribe'});await Promise.resolve();await Promise.resolve();expect(jobs.take('owner',created.id).text).toBe('synthetic transcript');expect(()=>jobs.take('owner',created.id)).toThrow();
  }finally{await jobs.close();}
 });
 it('does not publish a late result after cancellation',async()=>{
  let resolve!:(value:{text:string})=>void;
  const jobs=new LocalVoiceJobs(async()=>({}),()=>new Promise(r=>{resolve=r;}),async()=>({}));
  try{const created=jobs.create('owner','transcribe');await Promise.resolve();await Promise.resolve();jobs.start('owner',created.id,'transcribe',{task:'transcribe'});await jobs.cancel('owner',created.id);resolve({text:'late'});await Promise.resolve();expect(()=>jobs.status('owner',created.id)).toThrow();}
  finally{await jobs.close();}
 });
});
