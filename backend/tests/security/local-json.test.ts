import { it,expect } from "vitest";
import { mkdirSync,readFileSync,writeFileSync,mkdtempSync,rmSync } from "node:fs";
import { join,resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { LocalAnalysisStore } from "../../src/infrastructure/analysis/local-analysis-store.js";
import { LocalBuddyStore } from "../../src/infrastructure/analysis/local-buddy-store.js";
import { JsonRepository } from "../../src/infrastructure/analysis/json-repository.js";
import fixture from "../../../packages/contracts/fixtures/core-v2.json";
const base=resolve('../runtime-cache/json-tests');mkdirSync(base,{recursive:true});
it('persists readable native results, isolates accounts, rejects replay conflicts and independent writers',async()=>{
 const dir=mkdtempSync(join(base,'store-'));let store=new LocalAnalysisStore(dir);await store.ready;const user=randomUUID(),journal=randomUUID();
 try{const job=await store.create(user,journal,'key','hash');expect((await store.create(user,journal,'key','hash')).id).toBe(job.id);await expect(store.create(user,journal,'key','different')).rejects.toThrow();await expect(new JsonRepository(dir).ready).rejects.toThrow();expect(store.get(randomUUID(),job.id)).toBeUndefined();await store.set(user,job.id,'completed',100,JSON.stringify(fixture));expect(JSON.parse(readFileSync(join(dir,user,'analysis',job.id+'.json'),'utf8')).result).toEqual(fixture);await store.close();store=new LocalAnalysisStore(dir);await store.ready;expect(store.completed(user)).toHaveLength(1);await store.clear(user);expect(store.completed(user)).toHaveLength(0);}finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});
it('preserves corrupt files and rejects invalid outputs without blocking unrelated records',async()=>{
 const dir=mkdtempSync(join(base,'bad-'));let store=new LocalAnalysisStore(dir);await store.ready;const user=randomUUID(),job=await store.create(user,randomUUID(),'k','h');
 try{await expect(store.set(user,job.id,'completed',100,'{}')).rejects.toThrow();writeFileSync(join(dir,user,'analysis',job.id+'.json'),'{');await store.close();store=new LocalAnalysisStore(dir);await store.ready;expect(()=>store.get(user,job.id)).toThrow();expect(store.pending()).toHaveLength(0);expect(readFileSync(join(dir,user,'analysis',job.id+'.json'),'utf8')).toBe('{');}finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});
it('reopens Buddy messages and metadata without any database',async()=>{
 const dir=mkdtempSync(join(base,'buddy-')),user=randomUUID();let store=new LocalBuddyStore(dir);await store.ready;
 try{const c=await store.create(user);c.messages.push({id:randomUUID(),role:'buddy',content:'Synthetic reply',timestamp:new Date().toISOString()});await store.save(c);await store.close();store=new LocalBuddyStore(dir);await store.ready;expect(store.get(user,c.id).messages[0].content).toBe('Synthetic reply');expect(()=>store.get(randomUUID(),c.id)).toThrow();await store.remove(user,c.id);expect(store.list(user)).toHaveLength(0);}finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});
