import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,it,expect,vi} from 'vitest';
const service=vi.hoisted(()=>({
 getAccessStatus:vi.fn().mockResolvedValue({success:true,data:{canAccessAi:true,buddyHistoryEnabled:false}}),
 listConversations:vi.fn().mockResolvedValue({success:true,data:{conversations:[],pagination:{page:1,pageSize:20,totalItems:0,totalPages:0}}}),
 sendMessage:vi.fn().mockResolvedValue({success:false,error:{code:'LOADING',message:'Buddy is still loading. Your message has not been sent.'}}),
}));
vi.mock('@/services/buddy/buddy-service.factory',()=>({getBuddyService:()=>service}));
import {useBuddyViewModel} from './use-buddy-view-model';
beforeEach(()=>{
 service.getAccessStatus.mockResolvedValue({success:true,data:{canAccessAi:true,buddyHistoryEnabled:false}});
 service.listConversations.mockResolvedValue({success:true,data:{conversations:[],pagination:{page:1,pageSize:20,totalItems:0,totalPages:0}}});
 service.sendMessage.mockResolvedValue({success:false,error:{code:'LOADING',message:'Buddy is still loading. Your message has not been sent.'}});
});
it('removes an unsubmitted optimistic message and shows loading as status, without a failed reply',async()=>{
 const hook=renderHook(()=>useBuddyViewModel());await waitFor(()=>expect(hook.result.current.accessStatus).toBe('allowed'));
 await act(async()=>{expect(await hook.result.current.sendMessage(null,'Keep my pending text')).toBe(false);});
 expect(hook.result.current.error).toBeNull();expect(hook.result.current.loadingNotice).toMatch(/still loading/);expect(hook.result.current.messages).toEqual([]);expect(hook.result.current.isSending).toBe(false);expect(hook.result.current.isStreaming).toBe(false);expect(service.sendMessage).toHaveBeenCalledTimes(1);
 hook.unmount();
});
