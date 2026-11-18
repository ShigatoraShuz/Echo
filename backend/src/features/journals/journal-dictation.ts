import {LocalVoiceJobs} from '../experience/local-voice-jobs.js';
import type {CoreClient} from '../../infrastructure/analysis/core-client.js';
import {assertAiEnabled} from '../../infrastructure/security/runtime-controls.js';
import {ExternalServiceError} from '../../shared/errors/app-error.js';

/** Volatile audio jobs; independent of journal-analysis and Buddy consent. */
export class JournalDictation {
  private client(){const client=this.getClient();if(!client)throw new ExternalServiceError('AI_UNAVAILABLE','Journal dictation is unavailable.');return client;}
  private jobs:LocalVoiceJobs;
  constructor(private getClient:()=>CoreClient|undefined){
    this.jobs=new LocalVoiceJobs(
      (sessionId,_kind,signal)=>this.client().dictation({task:'warm_whisper',sessionId},signal),
      async(sessionId,payload,signal)=>{
        const result=await this.client().dictation({task:'transcribe',sessionId,audio:String(payload.audio)},signal);
        if(typeof result.text!=='string')throw new ExternalServiceError('AI_TRANSPORT_INVALID_RESPONSE','No transcript was returned.');
        return {text:result.text,model:result.model};
      },
      sessionId=>this.client().dictation({task:'close',sessionId},AbortSignal.timeout(10000)),
    );
  }
  async create(user:string,_provider:'whisper'='whisper'){await assertAiEnabled();return this.jobs.create(user,'transcribe');}
  status(user:string,id:string){return this.jobs.status(user,id);}
  result(user:string,id:string){return this.jobs.take(user,id);}
  async submit(user:string,id:string,audio:Buffer){await assertAiEnabled();return this.jobs.start(user,id,'transcribe',{audio:audio.toString('base64')});}
  cancel(user:string,id:string){return this.jobs.cancel(user,id);}
  close(){return this.jobs.close();}
}
