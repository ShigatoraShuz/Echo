import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,waitFor,act,cleanup,screen} from '@testing-library/react';
import {JournalRuntimeOwner} from './journal-runtime-owner';
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:async()=>'test-token'}}));
const lease={id:'40000000-0000-4000-8000-000000000001',profile:'journal',expiresAt:'2026-11-04T12:00:00.000Z',state:'ready',faceEligible:false};
const response=(value:unknown)=>({ok:true,json:async()=>({data:value})});
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_PAGE_MODEL_LEASES','true');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('acquires Journal ownership and releases its own lease on exit',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response(lease));vi.stubGlobal('fetch',fetcher);
 const view=render(<JournalRuntimeOwner/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/ai/runtime/leases'),expect.objectContaining({method:'POST',body:expect.stringContaining('journal')})));
 await act(async()=>{});view.unmount();
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(lease.id+'?profile=journal'),expect.objectContaining({method:'DELETE',keepalive:true})));
});
it('prefetches eligible camera assets without requesting a camera stream',async()=>{
 const getUserMedia=vi.fn();Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
 const fetcher=vi.fn().mockResolvedValue(response({...lease,faceEligible:true}));vi.stubGlobal('fetch',fetcher);
 render(<JournalRuntimeOwner/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/models/face_landmarker.task',expect.any(Object)));
 expect(getUserMedia).not.toHaveBeenCalled();
});
it('late acquisition after exit releases itself instead of updating a new page',async()=>{
 let finish!:(v:any)=>void;const pending=new Promise(r=>{finish=r;});
 const fetcher=vi.fn().mockReturnValueOnce(pending).mockResolvedValue(response({released:true}));vi.stubGlobal('fetch',fetcher);
 const view=render(<JournalRuntimeOwner/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));view.unmount();
 await act(async()=>{finish(response(lease));});
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(lease.id),expect.objectContaining({method:'DELETE'})));
});
it('service failure is visible without blocking private Journal content',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));render(<><JournalRuntimeOwner/><p>Private editor</p></>);
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Journal AI is not prepared'));
 expect(screen.getByText('Private editor')).toBeVisible();
});
