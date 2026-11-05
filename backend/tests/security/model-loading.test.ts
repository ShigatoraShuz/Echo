import {afterEach,it,expect,vi} from 'vitest';
import {CoreClient,coreRequestTimeout} from '../../src/infrastructure/analysis/core-client.js';
import {modelPreparationSchema,modelPageLeaseSchema} from '@echo/contracts';
import {ExperienceService} from '../../src/features/experience/experience.service.js';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const progress={component:'cbt',state:'loading',attempt:2,maxAttempts:5,elapsedSeconds:12,correlationId:'a'.repeat(32)};
it('extends only fixed preparation operations without extending generation',()=>{
 for(const task of ['warm','warm_chat','warm_nano','warm_whisper'])expect(coreRequestTimeout('/v1/talk',{task})).toBe(6600000);
 for(const task of ['chat','speak','transcribe','support_check','prepare'])expect(coreRequestTimeout('/v1/talk',{task})).toBe(600000);
 expect(coreRequestTimeout('/v2/chat',{task:'warm'})).toBe(300000);
 expect(coreRequestTimeout('/v2/analyze',{})).toBe(300000);
});
it('bounded protected progress fetch is deduplicated independently of inference',async()=>{
 let finish!:(r:Response)=>void;const fetcher=vi.fn((_input:string|URL|Request,_init?:RequestInit)=>new Promise<Response>(r=>finish=r));vi.stubGlobal('fetch',fetcher);
 const core=new CoreClient('http://127.0.0.1:8002','x'.repeat(32));
 const first=core.preparationStatus(),second=core.preparationStatus();expect(fetcher).toHaveBeenCalledTimes(1);
 expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:8002/v2/preparation');
 finish(new Response(JSON.stringify({preparation:progress}),{headers:{'content-type':'application/json'}}));
 expect(await first).toEqual(progress);expect(await second).toEqual(progress);expect(await core.preparationStatus()).toEqual(progress);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('malformed progress and private fields fail closed without being returned',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({preparation:{...progress,prompt:'private text',path:'C:/private'}}))));
 expect(await new CoreClient('http://127.0.0.1:8002','x'.repeat(32)).preparationStatus()).toBeUndefined();
 expect(modelPreparationSchema.safeParse({...progress,attempt:6}).success).toBe(false);
 expect(modelPreparationSchema.safeParse({...progress,code:'C:/private'}).success).toBe(false);
});
it('optional progress preserves older lease contracts',()=>{
 const lease={id:'11111111-1111-4111-8111-111111111111',profile:'buddy_chat',expiresAt:new Date().toISOString(),state:'preparing'};
 expect(modelPageLeaseSchema.safeParse(lease).success).toBe(true);
 expect(modelPageLeaseSchema.safeParse({...lease,preparation:progress}).success).toBe(true);
});
it('released lease cannot be returned by a delayed loading-status read',async()=>{
 let finish!:(v:unknown)=>void;
 const core:any={talk:vi.fn().mockResolvedValue({ready:true}),preparationStatus:()=>new Promise(r=>finish=r)};
 const service:any=new ExperienceService({} as any,{} as any,{} as any,undefined,undefined,core);service.validateTalk=async()=>({historyEnabled:false});
 try{
  const lease=await service.acquireModelLease('owner','session','client');await service.modelPageLeases.settled();
  const pending=service.modelLeaseStatus('owner','session',lease.id);
  service.releaseModelLease('owner','session',lease.id);finish(progress);
  await expect(pending).rejects.toThrow('RUNTIME_LEASE_NOT_FOUND');
 }finally{await service.closeModelLeases();}
});

it('Send returns loading promptly without inference or history while shared preparation continues',async()=>{
 vi.stubEnv('ECHO_BUDDY_ENABLED','true');let finish!:()=>void;
 const core:any={talk:vi.fn((payload:any)=>payload.task==='warm_chat'?new Promise<void>(r=>finish=r):Promise.resolve({closed:true})),chat:vi.fn().mockResolvedValue({reply:'Approved reply.',supportRequired:false})};
 const service:any=new ExperienceService({} as any,{} as any,{} as any,undefined,undefined,core);service.historyEnabled=async()=>false;
 try{
  await expect(service.sendBuddyMessage('owner','First pending message')).rejects.toMatchObject({code:'BUDDY_LOADING',statusCode:409});
  await expect(service.sendBuddyMessage('owner','Second pending message')).rejects.toMatchObject({code:'BUDDY_LOADING'});
  expect(core.talk.mock.calls.filter(([p]:any)=>p.task==='warm_chat')).toHaveLength(1);expect(core.chat).not.toHaveBeenCalled();expect(service.temporary.size).toBe(0);
  finish();await service.preparingBuddy;
  await expect(service.sendBuddyMessage('owner','Explicit Send after ready')).resolves.toHaveProperty('messages');
  expect(core.chat).toHaveBeenCalledWith([{role:'user',content:'Explicit Send after ready'}]);
 }finally{finish?.();await service.preparingBuddy;await service.closeModelLeases();}
});
it('failed preparation is reported as a real failure and Send does not silently retry loading',async()=>{
 vi.stubEnv('ECHO_BUDDY_ENABLED','true');const core:any={talk:vi.fn(),chat:vi.fn()};
 const service:any=new ExperienceService({} as any,{} as any,{} as any,undefined,undefined,core);service.historyEnabled=async()=>false;
 service.runtimeState={state:'failed',code:'BUDDY_CBT_ENV_ACCESS_DENIED'};
 await expect(service.sendBuddyMessage('owner','Hello')).rejects.toMatchObject({code:'BUDDY_CBT_ENV_ACCESS_DENIED'});expect(core.talk).not.toHaveBeenCalled();expect(core.chat).not.toHaveBeenCalled();await service.closeModelLeases();
});
it('prewritten support routing remains available while ordinary models are loading',async()=>{
 vi.stubEnv('ECHO_BUDDY_ENABLED','true');const core:any={talk:vi.fn(),chat:vi.fn()};
 const service:any=new ExperienceService({} as any,{} as any,{} as any,undefined,undefined,core,{} as any);service.historyEnabled=async()=>false;service.runtimeState={state:'preparing'};
 const result=await service.sendBuddyMessage('owner','I cannot keep myself safe');expect(result.messages[1].content).toMatch(/Crisis support/);expect(core.chat).not.toHaveBeenCalled();expect(core.talk).not.toHaveBeenCalled();await service.closeModelLeases();
});

it('preserves sanitized native loading codes across the private analysis boundary',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({detail:{code:'NATIVE_EMOTION_IMPORT_FAILED'}}),{status:503})));
 const core=new CoreClient('http://127.0.0.1:8002','x'.repeat(32));
 await expect(core.classify('Synthetic fixture')).rejects.toMatchObject({code:'NATIVE_EMOTION_IMPORT_FAILED',message:'Journal model loading failed: NATIVE_EMOTION_IMPORT_FAILED'});
});
