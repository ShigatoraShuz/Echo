import {describe,it,expect,vi} from 'vitest';
import {ExperienceService} from '../../src/features/experience/experience.service.js';
import {createEncryptionService,decryptText} from '../../src/infrastructure/encryption/encryption.service.js';
function fixture(){
 const rpc=vi.fn(async()=>({error:null}));const database={schema:vi.fn(()=>({rpc}))};
 const encryption=createEncryptionService(Buffer.alloc(32,7).toString('base64'),1);
 const s=new ExperienceService(database as any,{} as any,encryption,undefined,undefined,{} as any);
 vi.spyOn(s as any,'historyEnabled').mockResolvedValue(true);
 const owned=vi.spyOn(s as any,'ownedConversation').mockResolvedValue({id:'chat',last_message_at:'now'});
 vi.spyOn(s,'buddySession').mockResolvedValue({conversationId:'chat',messages:[{id:'prior',role:'buddy',content:'Previous reply',timestamp:'Now'}]} as any);
 return {s,rpc,encryption,owned};
}
describe('hosted Talk repository without standalone storage',()=>{
 it('starts with account ownership and restores saved context',async()=>{const {s,owned}=fixture();await expect(s.startTalkContext('user','chat')).resolves.toMatchObject({conversationId:'chat'});const accepted=await s.acceptTalkTurn('user','Hello','chat','temp','turn');expect(owned).toHaveBeenCalledWith('user','chat');expect(accepted.messages.map(m=>m.content)).toEqual(['Previous reply','Hello']);});
 it('rejects foreign conversations before accepting a turn',async()=>{const {s,owned}=fixture();owned.mockRejectedValue(new Error('not owned'));await expect(s.acceptTalkTurn('other','Hello','chat','temp','turn')).rejects.toThrow('not owned');});
 it('persists only approved text through the encrypted atomic exchange RPC',async()=>{const {s,rpc,encryption}=fixture();await s.acceptTalkTurn('user','Hello','chat','temp','turn');vi.mocked(s.buddySession).mockResolvedValue({messages:[{id:'reply',role:'buddy',content:'Approved answer',timestamp:'Now'}]} as any);await s.completeTalk('user','chat','temp','Approved answer','turn',{model:'exact-adapter'});const args=rpc.mock.calls[0] as any;expect(args[0]).toBe('save_exchange');expect(args[1].p_user_id).toBe('user');expect(decryptText(args[1].p_user_content,encryption)).toBe('Hello');expect(JSON.parse(decryptText(args[1].p_buddy_content,encryption))).toMatchObject({text:'Approved answer',turnId:'turn',provenance:{model:'exact-adapter'}});expect(JSON.stringify(args[1])).not.toContain('Approved answer');});
 it('keeps history-off turns temporary and rejects saved conversation reuse',async()=>{const {s,rpc}=fixture();vi.mocked((s as any).historyEnabled).mockResolvedValue(false);await expect(s.startTalkContext('user','chat')).rejects.toThrow('Saved chats');const accepted=await s.acceptTalkTurn('user','Hello',null,'temp','turn');expect(accepted.conversationId).toBeNull();expect(rpc).not.toHaveBeenCalled();});
});
