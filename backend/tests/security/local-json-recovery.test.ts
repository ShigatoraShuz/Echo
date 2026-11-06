import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {LocalAnalysisStore} from '../../src/infrastructure/analysis/local-analysis-store.js';
import {LocalBuddyStore} from '../../src/infrastructure/analysis/local-buddy-store.js';
const roots:Array<{root:string;store:LocalAnalysisStore}>=[];
afterEach(async()=>{for(const row of roots.splice(0)){await row.store.close().catch(()=>{});await rm(row.root,{recursive:true,force:true});}});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'echo-json-recovery-'));const analysis=new LocalAnalysisStore(root),buddy=new LocalBuddyStore(root);roots.push({root,store:analysis});await Promise.all([analysis.ready,buddy.ready]);return {root,analysis,buddy};}
describe('local repository recovery and isolation',()=>{
 it('deduplicates concurrent creation for the same authorized journal',async()=>{
  const {analysis}=await fixture(),user=randomUUID(),journal=randomUUID();
  const rows=await Promise.all(Array.from({length:5},()=>analysis.create(user,journal,'same-request','same-hash')));
  expect(new Set(rows.map(x=>x.id)).size).toBe(1);
  expect(analysis.pending()).toHaveLength(1);
 });
 it('returns detached histories and serializes concurrent metadata updates',async()=>{
  const {buddy}=await fixture(),user=randomUUID(),row=await buddy.create(user);
  const detached=buddy.get(user,row.id);detached.title='not saved';expect(buddy.get(user,row.id).title).not.toBe('not saved');
  await Promise.all([buddy.mutate(user,row.id,c=>{c.provenance.push({stage:'a'});return c;}),buddy.mutate(user,row.id,c=>{c.provenance.push({stage:'b'});return c;})]);
  expect(buddy.get(user,row.id).provenance).toHaveLength(2);
  expect(()=>buddy.get(randomUUID(),row.id)).toThrow();
 });
 it('fences old writes after explicit deletion and permits a fresh conversation',async()=>{
  const {buddy}=await fixture(),user=randomUUID(),row=await buddy.create(user),old=buddy.get(user,row.id);
  await buddy.clear(user);
  await expect(buddy.save(old)).rejects.toMatchObject({code:'LOCAL_DATA_DELETED'});
  expect((await buddy.create(user)).storageGeneration).toBe(1);
 });
 it('does not recover cancelled or safety-blocked jobs automatically',async()=>{
  const {analysis}=await fixture(),user=randomUUID();
  const blocked=await analysis.create(user,randomUUID(),'blocked','one');await analysis.set(user,blocked.id,'safety_action_required',10);
  const cancelled=await analysis.create(user,randomUUID(),'cancelled','two');await analysis.remove(user,cancelled.journal_id);
  expect(analysis.pending()).toHaveLength(0);
 });
 it('preserves corrupt committed files and ignores abandoned temporary content',async()=>{
  const root=await mkdtemp(join(tmpdir(),'echo-json-recovery-')),user=randomUUID(),id=randomUUID();
  const dir=join(root,user,'buddy');await mkdir(dir,{recursive:true});await writeFile(join(dir,id+'.json'),'{broken');await writeFile(join(dir,id+'.json.abandoned.tmp'),'{}');
  const analysis=new LocalAnalysisStore(root),buddy=new LocalBuddyStore(root);roots.push({root,store:analysis});await analysis.ready;
  expect(()=>buddy.get(user,id)).toThrow();expect(()=>buddy.list(user,true)).toThrow();
  const valid=await buddy.create(user);expect(buddy.list(user).map(x=>x.id)).toEqual([valid.id]);
  expect(await readFile(join(dir,id+'.json'),'utf8')).toBe('{broken');
  expect(await readFile(join(dir,id+'.json.abandoned.tmp'),'utf8')).toBe('{}');
 });
});
