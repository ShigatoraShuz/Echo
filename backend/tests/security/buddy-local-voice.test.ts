import { it, expect, vi } from 'vitest';
import { ExperienceService } from '../../src/features/experience/experience.service.js';

it('shares bounded temporary context and only speaks approved replies for their owner', async () => {
  const turns: any[] = [];
  let count = 0;
  const talk = vi.fn(async (payload: any) => {
    if (payload.task === 'prepare') return { groups: [[payload.text]] };
    if (payload.task === 'speak') return {
      segments: [{ audio: Buffer.alloc(4).toString('base64'), sampleRate: 48000, channels: 2 }],
      model: { providerName: 'local-nano' },
    };
    return { ok: true };
  });
  const client: any = {
    chat: async (messages: any) => {
      turns.push(messages);
      return { reply: 'Synthetic reply ' + (++count), supportRequired: false };
    },
    talk,
  };
  const service: any = new ExperienceService({} as any, {} as any, {} as any, undefined, undefined, client);
  service.historyEnabled = async () => false;
  await service.sendBuddyMessage('user-a', 'Hello');
  await service.sendBuddyMessage('user-a', 'Continue');
  expect(turns[1]).toHaveLength(3);
  await service.sendBuddyMessage('user-b', 'Hello');
  expect(turns[2]).toHaveLength(1);
  await expect(service.speakVoice('user-b', 'Synthetic reply 1')).rejects.toThrow();
  expect(talk).not.toHaveBeenCalled();
  const voice = await service.speakVoice('user-a', 'Synthetic reply 1');
  expect(Buffer.from(voice.audio, 'base64').subarray(0, 4).toString()).toBe('RIFF');
  expect(talk).toHaveBeenCalledWith(expect.objectContaining({ task: 'prepare', text: 'Synthetic reply 1',deliveryMode:'voice' }), undefined);
  expect(talk.mock.calls.filter(([p])=>['warm','prepare','speak'].includes(p.task)).every(([p])=>p.voiceMode==='expressive')).toBe(true);
  expect(talk).toHaveBeenCalledWith(expect.objectContaining({ task: 'close' }));
  const welcome=(await service.buddySession('user-a')).messages[0].content;
  await service.resolveSpokenReply('user-a',{text:welcome});
  await expect(service.speakVoice('user-a',welcome)).resolves.toHaveProperty('audio');
});

it('resolves saved replies through the owned conversation and ignores supplied replacement text',async()=>{
 const service:any=new ExperienceService({} as any,{} as any,{} as any);
 service.buddySession=vi.fn(async(user:string,id:string)=>{if(user!=='owner'||id!=='conversation')throw Error('not found');return {messages:[{id:'reply',role:'buddy',content:'Stored approved text'},{id:'user-message',role:'user',content:'User text'}]};});
 expect(await service.resolveSpokenReply('owner',{conversationId:'conversation',messageId:'reply',text:'Tampered'})).toBe('Stored approved text');
 await expect(service.resolveSpokenReply('other',{conversationId:'conversation',messageId:'reply'})).rejects.toThrow();
 await expect(service.resolveSpokenReply('owner',{conversationId:'conversation',messageId:'user-message'})).rejects.toThrow();
 await expect(service.resolveSpokenReply('owner',{messageId:'reply'})).rejects.toThrow();
});

it('isolates temporary sessions within the same account', async () => {
  const turns: any[] = [];
  const service: any = new ExperienceService({} as any, {} as any, {} as any, undefined, undefined, {
    chat: async (messages: any) => {
      turns.push(messages);
      return { reply: 'Synthetic', supportRequired: false };
    },
  } as any);
  service.historyEnabled = async () => false;
  await service.sendBuddyMessage('user', 'Hello', undefined, 'session-one');
  await service.sendBuddyMessage('user', 'Again', undefined, 'session-one');
  await service.sendBuddyMessage('user', 'New', undefined, 'session-two');
  expect(turns.map(messages => messages.length)).toEqual([1, 3, 1]);
});
