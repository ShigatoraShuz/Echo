import {render,screen,waitFor,cleanup,act} from '@testing-library/react';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({presence:vi.fn().mockResolvedValue({closed:false}),signOut:vi.fn().mockResolvedValue({error:null})}));
vi.mock('./app-presence',()=>({appPresenceEnabled:true,updateAppPresence:mocks.presence}));
vi.mock('@/infrastructure/supabase/browser-client',()=>({createBrowserSupabaseClient:()=>({auth:{
 getSession:async()=>({data:{session:{user:{id:'account'},access_token:'header.'+btoa(JSON.stringify({session_id:'40000000-0000-4000-8000-000000000001'}))+'.signature'}}}),
 signOut:mocks.signOut,onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),
}})}));
import {PrivateSessionBoundary} from './private-session-boundary';
beforeEach(()=>{mocks.presence.mockResolvedValue({closed:false});mocks.signOut.mockResolvedValue({error:null});});
afterEach(()=>{cleanup();vi.useRealTimers();mocks.presence.mockClear();mocks.signOut.mockClear();});
it('registers presence before revealing private content and releases on unmount',async()=>{
 const view=render(<PrivateSessionBoundary userId="account"><p>Private</p></PrivateSessionBoundary>);
 await waitFor(()=>expect(screen.getByText('Private')).toBeVisible());
 expect(mocks.presence).toHaveBeenCalledWith('register');view.unmount();expect(mocks.presence).toHaveBeenCalledWith('release');
});
it('presence mode has no inactivity logout while heartbeat remains active',async()=>{
 vi.useFakeTimers();render(<PrivateSessionBoundary userId="account"><p>Private</p></PrivateSessionBoundary>);
 await act(async()=>{await Promise.resolve();await Promise.resolve();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(31*60*1000);});
 expect(mocks.signOut).not.toHaveBeenCalled();expect(mocks.presence).toHaveBeenCalledWith('heartbeat');
});

it('does not overlap slow presence heartbeats',async()=>{
 vi.useFakeTimers();render(<PrivateSessionBoundary userId="account"><p>Private</p></PrivateSessionBoundary>);
 await act(async()=>{await Promise.resolve();await Promise.resolve();});let finish!:(v:{closed:boolean})=>void;
 mocks.presence.mockImplementationOnce(()=>new Promise(r=>finish=r));
 await act(async()=>{await vi.advanceTimersByTimeAsync(45000);});
 expect(mocks.presence.mock.calls.filter(([action])=>action==='heartbeat')).toHaveLength(1);
 await act(async()=>{finish({closed:false});await Promise.resolve();});expect(mocks.signOut).not.toHaveBeenCalled();
});
it('reports a temporary heartbeat outage and recovers without logging out',async()=>{
 vi.useFakeTimers();render(<PrivateSessionBoundary userId="account"><p>Private</p></PrivateSessionBoundary>);
 await act(async()=>{await Promise.resolve();await Promise.resolve();});mocks.presence.mockRejectedValueOnce(new Error('offline'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/);expect(mocks.signOut).not.toHaveBeenCalled();
 await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByText('Private')).toBeVisible();expect(mocks.signOut).not.toHaveBeenCalled();
});
