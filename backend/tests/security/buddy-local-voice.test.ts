import { it, expect, vi } from 'vitest';
import { ExperienceService } from '../../src/features/experience/experience.service.js';

it('shares bounded temporary context and only speaks approved replies for their owner', async () => {
  const turns: any[] = [];
  let count = 0;
  const talk = vi.fn(async (payload: any) => {
    if (payload.task === 'prepare') return { groups: [[payload.text]] };
    if (payload.task === 'speak') return {
      segments: [{ audio: Buffer.alloc(4).toString('base64') }],
      model: { provider: 'synthetic-test' },
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
  expect(talk).toHaveBeenCalledWith(expect.objectContaining({ task: 'prepare', text: 'Synthetic reply 1' }), undefined);
  expect(talk).toHaveBeenCalledWith(expect.objectContaining({ task: 'close' }));
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
