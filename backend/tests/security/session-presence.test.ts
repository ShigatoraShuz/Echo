import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {SessionPresenceStore} from '../../src/infrastructure/security/session-presence.js';
function scenario(run:(s:SessionPresenceStore,t:(n:number)=>void,root:string)=>void){const root=mkdtempSync(join(tmpdir(),'echo-presence-'));let now=1000;try{run(new SessionPresenceStore(root,()=>now),n=>{now+=n},root);}finally{rmSync(root,{recursive:true,force:true});}}
it('one tab closing does not log out another; a last-tab refresh cancels grace',()=>scenario((s,t)=>{
 s.update('u','s','a','register');s.update('u','s','b','register');s.update('u','s','a','release');t(31000);expect(s.isClosed('u','s')).toBe(false);
 s.update('u','s','b','release');t(29000);s.update('u','s','c','register');expect(s.isClosed('u','s')).toBe(false);
}));
it('last-tab grace expires across restart and old sessions cannot register again',()=>scenario((s,t,root)=>{
 s.update('u','s','a','register');s.update('u','s','a','release');t(30000);
 const restored=new SessionPresenceStore(root,()=>31000);expect(restored.isClosed('u','s')).toBe(true);expect(restored.update('u','s','b','register')).toEqual({closed:true});
 expect(restored.update('u','new','b','register')).toEqual({closed:false});
}));
it('unconfirmed heartbeat loss allows reconnection but still has a bounded expiry',()=>scenario((s,t)=>{
 s.update('u','s','a','register');t(121000);expect(s.isClosed('u','s')).toBe(false);
 expect(s.update('u','s','a','heartbeat')).toEqual({closed:false});
 t(90000+30*60*1000);expect(s.isClosed('u','s')).toBe(true);
}));
it('logout closes only its shared session and persists no raw identities or tokens',()=>scenario((s,t,root)=>{
 s.update('private-user','private-session','a','register');s.update('private-user','other-session','b','register');s.update('private-user','private-session','a','logout');
 expect(s.isClosed('private-user','private-session')).toBe(true);expect(s.isClosed('private-user','other-session')).toBe(false);
 for(const name of readdirSync(root)){const text=readFileSync(join(root,name),'utf8');expect(text).not.toContain('private-session');expect(text).not.toContain('private-user');}
}));
