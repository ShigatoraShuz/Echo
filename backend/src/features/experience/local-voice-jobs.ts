import {randomUUID} from 'node:crypto';
import {ConflictError,NotFoundError} from '../../shared/errors/app-error.js';
type Kind='speak'|'transcribe';
type Output={audio?:string;text?:string;model?:Record<string,unknown>};
type Job={id:string;user:string;session:string;kind:Kind;state:'preparing'|'prepared'|'working'|'complete'|'failed';expires:number;controller:AbortController;result?:Output;code?:string};
/** Bounded volatile operations, never a second history store or an audio file. */
export class LocalVoiceJobs {
 private jobs=new Map<string,Job>();
 private timer:ReturnType<typeof setInterval>;
 constructor(private prepare:(session:string,kind:Kind,signal:AbortSignal)=>Promise<unknown>,private run:(session:string,payload:Record<string,unknown>,signal:AbortSignal,user:string)=>Promise<Output>,private release:(session:string)=>Promise<unknown>){
  this.timer=setInterval(()=>{for(const job of this.jobs.values())if(job.expires<Date.now())void this.cancel(job.user,job.id);},15000);this.timer.unref();
 }
 private get(user:string,id:string){const job=this.jobs.get(id);if(!job||job.user!==user||job.expires<Date.now())throw new NotFoundError('This local voice operation is unavailable.');return job;}
 create(user:string,kind:Kind){if(this.jobs.size>=2)throw new ConflictError('VOICE_BUSY','Finish or cancel the current voice operation.');const job:Job={id:randomUUID(),session:randomUUID(),user,kind,state:'preparing',expires:Date.now()+6_620_000,controller:new AbortController()};this.jobs.set(job.id,job);
  void this.prepare(job.session,kind,job.controller.signal).then(()=>{if(this.jobs.get(job.id)!==job||job.controller.signal.aborted)return;job.state='prepared';job.expires=Date.now()+120000;}).catch(error=>this.fail(job,error));return {id:job.id,state:job.state};
 }
 status(user:string,id:string){const job=this.get(user,id);return {id,state:job.state,code:job.code};}
 start(user:string,id:string,kind:Kind,payload:Record<string,unknown>){const job=this.get(user,id);if(job.kind!==kind||job.state!=='prepared')throw new ConflictError('VOICE_NOT_PREPARED','Wait for voice preparation before submitting.');job.state='working';job.expires=Date.now()+620000;
  void this.run(job.session,payload,job.controller.signal,job.user).then(result=>{if(this.jobs.get(id)!==job||job.controller.signal.aborted)return;if(Buffer.byteLength(result.audio??'')>48*1024*1024)throw new Error('Audio bound');job.result=result;job.state='complete';job.expires=Date.now()+90000;}).catch(error=>this.fail(job,error));return {id,state:job.state};
 }
 private fail(job:Job,error:unknown){if(this.jobs.get(job.id)!==job)return;const code=(error as {code?:string})?.code;job.code=typeof code==='string'&&/^(?:[A-Z0-9_]{1,80}|BUDDY_MOSS_NATIVE_EXIT_0x[0-9A-Fa-f]{8})$/.test(code)?code:'BUDDY_VOICE_OPERATION_FAILED';job.state='failed';job.expires=Date.now()+90000;void this.release(job.session).catch(()=>{});}
 take(user:string,id:string){const job=this.get(user,id);if(job.state!=='complete'||!job.result)throw new ConflictError('VOICE_NOT_COMPLETE','Voice processing is not complete.');const result=job.result;job.result=undefined;this.jobs.delete(id);void this.release(job.session).catch(()=>{});return result;}
 async cancel(user:string,id:string){const job=this.jobs.get(id);if(!job||job.user!==user)return;this.jobs.delete(id);job.controller.abort();job.result=undefined;await this.release(job.session).catch(()=>{});}
 async clear(user:string){await Promise.all([...this.jobs.values()].filter(x=>x.user===user).map(x=>this.cancel(user,x.id)));}
 async close(){clearInterval(this.timer);await Promise.all([...this.jobs.values()].map(x=>this.cancel(x.user,x.id)));}
}
