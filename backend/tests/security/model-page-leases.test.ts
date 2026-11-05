import {it,expect,vi} from 'vitest';
import {ModelPageLeases as Leases} from '../../src/infrastructure/analysis/model-page-leases.js';
// Original unit cases select zero grace to retain their isolated ownership assertions.
class ModelPageLeases extends Leases{
 constructor(...args:ConstructorParameters<typeof Leases>){super(args[0],args[1],args[2],args[3],args[4],args[5],0);}
}
it('prepares once and unloads only after the last owning tab releases',async()=>{
 const prepare=vi.fn().mockResolvedValue(undefined),unload=vi.fn().mockResolvedValue(undefined);const store=new ModelPageLeases(prepare,unload);
 try{const a=store.acquire('u','s','a'),b=store.acquire('u','s','b');await store.settled();expect(prepare).toHaveBeenCalledTimes(1);
 store.release('u','s',a.id);await store.settled();expect(unload).not.toHaveBeenCalled();
 store.release('u','s',b.id);await store.settled();expect(unload).toHaveBeenCalledTimes(1);
 store.release('u','s',b.id);await store.settled();expect(unload).toHaveBeenCalledTimes(1);
 }finally{await store.close();}
});
it('deduplicates mounts and isolates accounts and verified sessions',async()=>{
 const store=new ModelPageLeases(async()=>{},async()=>{});
 try{const a=store.acquire('u','s','a');expect(store.acquire('u','s','a').id).toBe(a.id);
 expect(()=>store.status('other','s',a.id)).toThrow();expect(()=>store.release('u','other-session',a.id)).toThrow();expect(store.count).toBe(1);
 }finally{await store.close();}
});
it('a delayed old release cannot unload a replacement page during preparation',async()=>{
 let ready!:()=>void;const unload=vi.fn().mockResolvedValue(undefined);const store=new ModelPageLeases(()=>new Promise<void>(r=>ready=r),unload);
 try{const old=store.acquire('u','s','old');await Promise.resolve();store.release('u','s',old.id);const next=store.acquire('u','s','new');ready();await store.settled();
 store.release('u','s',old.id);await store.settled();expect(unload).not.toHaveBeenCalled();expect(store.status('u','s',next.id).state).toBe('ready');
 }finally{await store.close();}
});
it('a page closing during preparation is unloaded after preparation completes',async()=>{
 let ready!:()=>void;const unload=vi.fn().mockResolvedValue(undefined);const store=new ModelPageLeases(()=>new Promise<void>(r=>ready=r),unload);
 const lease=store.acquire('u','s','a');await Promise.resolve();store.release('u','s',lease.id);ready();await store.settled();expect(unload).toHaveBeenCalledTimes(1);await store.close();
});
it('heartbeat expiry and confirmed logout release ownership; unknown session state does not',async()=>{
 let now=1000,closed=false,unknown=false;const unload=vi.fn().mockResolvedValue(undefined);
 const store=new ModelPageLeases(async()=>{},unload,()=>now,()=>{if(unknown)throw Error('unavailable');return closed;});
 try{const a=store.acquire('u','s','a');await store.settled();unknown=true;store.sweep();expect(store.count).toBe(1);unknown=false;
 now+=45000;store.heartbeat('u','s',a.id);now+=45000;store.sweep();expect(store.count).toBe(1);
 closed=true;store.sweep();await store.settled();expect(unload).toHaveBeenCalledTimes(1);
 closed=false;store.acquire('u','new','b');await store.settled();now+=60000;store.sweep();await store.settled();expect(unload).toHaveBeenCalledTimes(2);
 }finally{await store.close();}
});


it('retries capacity waiting after release without marking it a permanent loading failure',async()=>{
 let busy=true;const prepare=vi.fn(async()=>{if(busy)throw {code:'TALK_BUSY'};});
 const store=new ModelPageLeases(prepare,async()=>{});
 try{const lease=store.acquire('u','s','tab');await store.settled();expect(store.status('u','s',lease.id).state).toBe('waiting_for_capacity');
 busy=false;store.sweep(true);await store.settled();expect(store.status('u','s',lease.id).state).toBe('ready');
 }finally{await store.close();}
});

it('polling, heartbeats and repeated acquire cannot reset exhausted loading attempts',async()=>{
 const prepare=vi.fn(async()=>{throw {code:'BUDDY_CBT_LOAD_TIMEOUT'};});const store=new ModelPageLeases(prepare,async()=>{});
 try{
  const lease=store.acquire('u','s','tab');await store.settled();
  for(let i=0;i<3;i++){store.status('u','s',lease.id);store.heartbeat('u','s',lease.id);store.acquire('u','s','tab');store.sweep(true);}
  await store.settled();expect(prepare).toHaveBeenCalledTimes(1);expect(store.status('u','s',lease.id).state).toBe('failed');
  store.release('u','s',lease.id);await store.settled();store.acquire('u','s','new-page');await store.settled();expect(prepare).toHaveBeenCalledTimes(2);
 }finally{await store.close();}
});

it('retains models for ten seconds and cancels release when the user returns',async()=>{
 vi.useFakeTimers();const prepare=vi.fn(async()=>{}),unload=vi.fn(async()=>{});const store=new Leases(prepare,unload);
 try{
  const a=store.acquire('u','s','a');await store.settled();store.release('u','s',a.id);
  expect(store.releaseStatus.releasePending).toBe(true);await vi.advanceTimersByTimeAsync(9000);expect(unload).not.toHaveBeenCalled();
  const b=store.acquire('u','s','b');await store.settled();await vi.advanceTimersByTimeAsync(2000);expect(unload).not.toHaveBeenCalled();expect(prepare).toHaveBeenCalledTimes(1);expect(store.status('u','s',b.id).state).toBe('ready');
  store.release('u','s',b.id);await vi.advanceTimersByTimeAsync(10000);await store.settled();expect(unload).toHaveBeenCalledTimes(1);
 }finally{await store.close();vi.useRealTimers();}
});
it('other owning tabs prevent release; shutdown bypasses grace',async()=>{
 vi.useFakeTimers();const unload=vi.fn(async()=>{});const store=new Leases(async()=>{},unload);
 try{
  const a=store.acquire('u','s','a');store.acquire('u','s','b');await store.settled();store.release('u','s',a.id);await vi.advanceTimersByTimeAsync(10000);expect(unload).not.toHaveBeenCalled();expect(store.releaseStatus.releasePending).toBe(false);
  await store.close();expect(unload).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers();}
});
it('leaving during preparation uses the original exit deadline rather than restarting grace after loading',async()=>{
 vi.useFakeTimers();let finish!:()=>void;const unload=vi.fn(async()=>{});const store=new Leases(()=>new Promise<void>(r=>finish=r),unload);
 try{const a=store.acquire('u','s','a');await Promise.resolve();store.release('u','s',a.id);await vi.advanceTimersByTimeAsync(10000);expect(unload).not.toHaveBeenCalled();finish();await store.settled();expect(unload).toHaveBeenCalledTimes(1);}
 finally{await store.close();vi.useRealTimers();}
});

it('confirmed logout bypasses the release grace',async()=>{
 const unload=vi.fn(async()=>{});let closed=false;const store=new Leases(async()=>{},unload,Date.now,()=>closed);
 const a=store.acquire('u','s','a');await store.settled();closed=true;store.release('u','s',a.id);await store.settled();expect(unload).toHaveBeenCalledTimes(1);expect(store.releaseStatus.releasePending).toBe(false);await store.close();
});
