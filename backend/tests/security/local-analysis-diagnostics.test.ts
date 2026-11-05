import { it, expect, vi } from 'vitest';
import { JournalService } from '../../src/features/journals/journals.service.js';
import { ExternalServiceError } from '../../src/shared/errors/app-error.js';

it.each([
  [new ExternalServiceError('NATIVE_EMOTION_LOAD_FAILED','private diagnostic sentinel'),'NATIVE_EMOTION_LOAD_FAILED'],
  [new Error('private diagnostic sentinel'),'LOCAL_ANALYSIS_FAILED'],
])('records only safe combined-stage failure metadata',async(error,code)=>{
  const job:any={id:'synthetic-job',user_id:'synthetic-owner',journal_id:'synthetic-journal',status:'queued',progress:0,approved:0};
  const store={get:()=>job,set:(_user:string,_id:string,status:string,progress:number)=>{job.status=status;job.progress=Math.max(job.progress,progress);}};
  const service:any=Object.create(JournalService.prototype);
  service.localResults=store;service.journalPageActive=()=>true;
  service.hasGlobalAnalysisConsent=async()=>true;service.assertAnalysisGates=async()=>{};
  service.get=async()=>({body:'private reflection sentinel'});
  service.coreClient={ready:async()=>true,talkBusy:async()=>false,
    classify:async()=>({suicidal_language_flag:false}),analyze:async()=>{throw error;}};
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{
    await service.processLocal(job);
    expect(job.status).toBe('failed');
    expect(JSON.parse(warning.mock.calls[0][0])).toEqual({service:'local-ai',event:'journal_analysis_failed',code,stage:'combined_analysis',progress:25});
    const output=JSON.stringify(warning.mock.calls);
    expect(output).not.toContain('private');expect(output).not.toContain('synthetic-owner');
  }finally{warning.mockRestore();}
});
