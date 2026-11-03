import {it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {RealtimeTalkHub} from '../../src/features/experience/realtime-talk.js';
import {atomicJson} from '../../src/infrastructure/analysis/atomic-json.js';
import {prepareBuddyContext} from '../../src/features/experience/buddy-context.js';
it('an old completed playback cannot mutate or finish a newer reply',async()=>{
 const h:any=Object.create(RealtimeTalkHub.prototype);let release!:()=>void;
 h.service={talkDelivery:()=>new Promise<void>(r=>release=r)};const events:any[]=[];h.send=(_:any,e:any)=>events.push(e);
 const s:any={id:'s',generation:1,turnId:'old',replyId:'old',playedSamples:0};
 const p=h.markDelivery(s,'played');s.generation=2;s.turnId='new';s.replyId='new';release();await p;
 expect(events).toEqual([]);expect(s.replyId).toBe('new');
});
it('context preserves latest user and records reductions without mutating display history',()=>{
 const history=Array.from({length:25},(_,i)=>({role:i===24?'user' as const:'assistant' as const,content:String(i)}));
 const a=prepareBuddyContext(history);expect(a.messages).toHaveLength(20);expect(a.messages.at(-1)?.content).toBe('24');expect(a.reduction.droppedMessages).toBe(5);expect(history).toHaveLength(25);
});
it('stale temp files cannot block commits and failed serialization preserves committed data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'echo-atomic-'));const f=join(dir,'record.json');
 try {atomicJson(f,{version:1});writeFileSync(f+'.tmp','abandoned');atomicJson(f,{version:2});expect(JSON.parse(readFileSync(f,'utf8'))).toEqual({version:2});const bad:any={};bad.self=bad;expect(()=>atomicJson(f,bad)).toThrow();expect(JSON.parse(readFileSync(f,'utf8'))).toEqual({version:2});expect(readdirSync(dir).filter(x=>x.endsWith('.tmp'))).toEqual(['record.json.tmp']);}finally{rmSync(dir,{recursive:true,force:true});}
});
