import {randomUUID} from 'node:crypto';
export type ModelPageLease={id:string;user:string;session:string;client:string;expires:number};
/** Serializes preparation/release while keeping status and heartbeats synchronous. */
export class ModelPageLeases {
 private leases=new Map<string,ModelPageLease>();
 private tail:Promise<void>=Promise.resolve();
 private activePreparation?:AbortController;
 private preparing=false;private unloading=false;private stopped=false;
 private timer:ReturnType<typeof setInterval>|undefined;
 private releaseTimer:ReturnType<typeof setTimeout>|undefined;
 private releaseAt:number|null=null;
 get releaseStatus(){return {releasePending:this.releaseAt!==null,...(this.releaseAt!==null?{releaseAt:new Date(this.releaseAt).toISOString()}:{})};}
 private preparationFailures=0;private retryAt=0;
 private state:{state:string;code?:string}={state:'unloaded'};
 constructor(private prepare:(signal?:AbortSignal)=>Promise<void>,private unload:()=>Promise<unknown>,private now:()=>number=Date.now,private sessionClosed:(user:string,session:string)=>boolean=()=>false,private profile:'buddy_chat'|'journal'='buddy_chat',private onChanged?:()=>Promise<void>,private releaseGraceMs=10000){}
 get count(){return this.leases.size;}
 hasUser(user:string){this.sweep();return [...this.leases.values()].some(l=>l.user===user);}
 users(){return [...new Set([...this.leases.values()].map(l=>l.user))];}
 private startTimer(){if(!this.timer){this.timer=setInterval(()=>this.sweep(true),5000);this.timer.unref();}}
 acquire(user:string,session:string,client:string){
  if(this.stopped)throw Error('RUNTIME_STOPPED');
  this.sweep();this.cancelRelease();
  let lease=[...this.leases.values()].find(l=>l.user===user&&l.session===session&&l.client===client);
  if(!lease){if(this.leases.size>=128)throw Error('RUNTIME_LEASE_LIMIT');lease={id:randomUUID(),user,session,client,expires:0};this.leases.set(lease.id,lease);if(this.state.state==='failed')this.preparationFailures=0;if(this.onChanged){this.enqueue(()=>this.onChanged!());if(this.state.state==='ready')this.state={state:'unloaded'};}}
  lease.expires=this.now()+60000;this.startTimer();this.ensurePrepared();return this.result(lease);
 }
 private owned(user:string,session:string,id:string){const lease=this.leases.get(id);if(!lease||lease.user!==user||lease.session!==session)throw Error('RUNTIME_LEASE_NOT_FOUND');return lease;}
 status(user:string,session:string,id:string){this.sweep();return this.result(this.owned(user,session,id));}
 heartbeat(user:string,session:string,id:string){this.sweep();const lease=this.owned(user,session,id);lease.expires=this.now()+60000;return this.result(lease);}
 release(user:string,session:string,id:string){const existing=this.leases.get(id);if(existing){this.owned(user,session,id);this.leases.delete(id);if(this.onChanged)this.enqueue(()=>this.onChanged!());}if(!this.count){let closed=false;try{closed=this.sessionClosed(user,session);}catch{/* Unknown state is not confirmed logout. */}if(closed){this.cancelRelease();this.ensureUnloaded();}else this.scheduleRelease();}return {released:true,...this.releaseStatus};}
 private result(lease:ModelPageLease){return {id:lease.id,profile:this.profile,expiresAt:new Date(lease.expires).toISOString(),...this.state,...this.releaseStatus};}
 sweep(retryCapacity=false){let confirmedClosed=false;for(const [id,l] of this.leases){let closed=false;try{closed=this.sessionClosed(l.user,l.session);}catch{/* Unknown session state is not confirmed logout. */}if(l.expires<=this.now()||closed){confirmedClosed=confirmedClosed||closed;this.leases.delete(id);if(this.onChanged)this.enqueue(()=>this.onChanged!());}}if(!this.count&&this.state.state!=='unloaded'){if(confirmedClosed){this.cancelRelease();this.ensureUnloaded();}else this.scheduleRelease();}else if(retryCapacity&&this.count&&(this.state.state==='waiting_for_capacity'||this.state.state==='failed'))this.ensurePrepared();}
 private cancelRelease(){if(this.releaseTimer)clearTimeout(this.releaseTimer);this.releaseTimer=undefined;this.releaseAt=null;}
 private scheduleRelease(){
  if(this.count||this.stopped)return;
  if(this.state.state==='unloaded'&&!this.preparing){this.cancelRelease();return;}
  this.releaseAt??=this.now()+this.releaseGraceMs;
  const remaining=this.releaseAt-this.now();
  if(remaining<=0){this.ensureUnloaded();return;}
  if(!this.releaseTimer){this.releaseTimer=setTimeout(()=>{this.releaseTimer=undefined;if(!this.count)this.scheduleRelease();},remaining);this.releaseTimer.unref();}
 }
 private enqueue(fn:()=>Promise<void>){this.tail=this.tail.then(fn).catch(()=>{});}
 private ensurePrepared(){
  if(this.preparing||this.state.state==='ready')return;
  if(this.state.state==='failed'&&(this.preparationFailures>=3||this.now()<this.retryAt))return;
  const controller=new AbortController();this.activePreparation=controller;
  this.preparing=true;this.state={state:'preparing'};
  this.enqueue(async()=>{
   try{if(!this.count||controller.signal.aborted)return;await this.prepare(controller.signal);if(!controller.signal.aborted){this.state={state:'ready'};this.preparationFailures=0;}}
   catch(error){if(!controller.signal.aborted){const code=this.safeCode(error,'MODEL_PREPARATION_FAILED');this.state={state:code==='TALK_BUSY'?'waiting_for_capacity':'failed',code};if(code!=='TALK_BUSY'){this.preparationFailures++;this.retryAt=this.now()+30000;}}}
   finally{
    if(this.activePreparation===controller)this.activePreparation=undefined;
    this.preparing=false;
    if(controller.signal.aborted)this.state={state:'unloaded'};
    if(!this.count){if(this.stopped)this.ensureUnloaded();else this.scheduleRelease();}
    else if(controller.signal.aborted&&!this.stopped)this.ensurePrepared();
   }
  });
 }
 private safeCode(error:unknown,fallback:string){const code=(error as {code?:string})?.code;return typeof code==='string'&&/^[A-Z_]{1,80}$/.test(code)?code:fallback;}
 private ensureUnloaded(){
  if(this.unloading||(this.state.state==='unloaded'&&!this.preparing))return;this.unloading=true;
  // Runs outside the serialized work queue. Recheck ownership before aborting;
  // immediate replacement mounts must not cancel a still-shared preparation.
  const preparation=this.activePreparation;
  queueMicrotask(()=>{if(!this.count&&this.activePreparation===preparation)preparation?.abort();});
  this.enqueue(async()=>{
   try{if(this.count)return;this.state={state:'releasing'};await this.unload();this.state={state:'unloaded'};if(!this.count)this.cancelRelease();}
   catch(error){this.state={state:'releasing',code:this.safeCode(error,'MODEL_RELEASE_PENDING')};}
   finally{this.unloading=false;}
  });
 }
 async settled(){let tail:Promise<void>;do{tail=this.tail;await tail;}while(tail!==this.tail);}
 async close(){this.stopped=true;this.cancelRelease();if(this.timer)clearInterval(this.timer);this.leases.clear();this.ensureUnloaded();await this.tail;}
}
