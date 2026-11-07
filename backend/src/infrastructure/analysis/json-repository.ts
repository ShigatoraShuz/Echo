import {mkdir,open,readFile,readdir,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {AppError,ConflictError} from '../../shared/errors/app-error.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const corrupt=(id:string)=>new AppError({statusCode:503,code:'LOCAL_RECORD_CORRUPT',message:'A saved local record needs recovery. Other records remain available.',details:{recordId:id}});
export async function writeJsonAtomic(file:string,value:unknown){
 const serialized=JSON.stringify(value,null,2);
 const temporary=file+'.'+randomUUID()+'.tmp';let handle:Awaited<ReturnType<typeof open>>|undefined;
 try{handle=await open(temporary,'wx');await handle.writeFile(serialized);await handle.sync();await handle.close();handle=undefined;await rename(temporary,file);return createHash('sha256').update(serialized).digest('hex');}
 catch{throw new AppError({statusCode:503,code:'LOCAL_STORAGE_WRITE_FAILED',message:'The local record could not be saved. Existing committed data was preserved.'});}
 finally{try{await handle?.close();}catch{/* Preserve the original write error. */}try{await unlink(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')console.warn(JSON.stringify({service:'local-json',code:'LOCAL_TEMP_CLEANUP_REQUIRED'}));}}
}

/** One process owns this root. Reads use a detached, initialized in-memory index. */
export class JsonRepository {
 readonly ready:Promise<void>;
 private records=new Map<string,Record<string,unknown>>();
 private committedHashes=new Map<string,string>();
 private summaries=new Map<string,{value:{id:string;title:string;preview:string;archived:boolean;pinned_at:string|null;last_message_at:string|null;created_at:string};search:string}>();
 private damaged=new Set<string>();
 private retired=new Set<string>();
 private tails=new Map<string,Promise<unknown>>();
 private validators=new Map<string,(value:unknown)=>Record<string,unknown>>();
 private generations:Record<string,number>={};
 private owner=JSON.stringify({pid:process.pid,nonce:randomUUID()});
 private closed=false;
 private initialized=false;
 constructor(readonly root:string){this.ready=Promise.resolve().then(()=>this.initialize());}
 register(kind:'analysis'|'buddy',validate:(value:unknown)=>Record<string,unknown>){this.validators.set(kind,validate);}
 private key(user:string,kind:string,id:string){if(!uuid.test(user)||!uuid.test(id)||!['analysis','buddy'].includes(kind))throw new Error('Invalid local record identity');return join(user,kind,id+'.json');}
 private async initialize(){
  await mkdir(this.root,{recursive:true});const lock=join(this.root,'.writer.lock');
  try{const fd=await open(lock,'wx');try{await fd.writeFile(this.owner);await fd.sync();}finally{await fd.close();}}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
   const prior=await readFile(lock,'utf8');const parsed=JSON.parse(prior);const pid=Number(typeof parsed==='number'?parsed:parsed.pid);
   if(!Number.isSafeInteger(pid)||pid<=0)throw new Error('Invalid local writer lease');
   try{process.kill(pid,0);throw new Error('Local storage already has a writer');}catch(probe){if((probe as NodeJS.ErrnoException).code!=='ESRCH')throw probe;}
   if(await readFile(lock,'utf8')!==prior)throw new Error('Local writer lease changed');
   await unlink(lock);const fd=await open(lock,'wx');try{await fd.writeFile(this.owner);await fd.sync();}finally{await fd.close();}
  }
  try{
   try{this.generations=JSON.parse(await readFile(join(this.root,'.deletion-generations.json'),'utf8'));if(!this.generations||Array.isArray(this.generations)||Object.entries(this.generations).some(([u,g])=>!uuid.test(u)||!Number.isSafeInteger(g)||g<0))throw new Error('Invalid local deletion state');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   for(const user of await readdir(this.root))if(uuid.test(user))for(const kind of ['analysis','buddy']){
    const dir=join(this.root,user,kind);let names:string[]=[];
    try{names=await readdir(dir);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    for(const name of names){if(!name.endsWith('.json'))continue;const id=name.slice(0,-5);if(!uuid.test(id))continue;const key=this.key(user,kind,id);
     try{const content=await readFile(join(dir,name),'utf8');const raw=JSON.parse(content);const validate=this.validators.get(kind);const record=validate?validate(raw):raw;if(record.user_id!==user||record.id!==id)throw new Error('Local ownership mismatch');const generation=Number(record.storageGeneration??0);if(generation<this.generation(user)){this.retired.add(key);console.warn(JSON.stringify({service:'local-json',code:'LOCAL_DELETION_RECOVERY_REQUIRED',recordId:id}));continue;}if(generation!==this.generation(user))throw new Error('Invalid local generation');this.committedHashes.set(key,createHash('sha256').update(content).digest('hex'));this.publish(key,record);}
     catch{this.damaged.add(key);console.warn(JSON.stringify({service:'local-json',code:'LOCAL_RECORD_CORRUPT',recordId:id}));}
    }
   }
   this.initialized=true;
  }catch(error){if(await readFile(lock,'utf8')===this.owner)await unlink(lock);throw error;}
 }
 private available(){if(!this.initialized||this.closed)throw new Error('Local storage is not ready');}
 private async assertCommitted(key:string,id:string){let actual:string|undefined;try{actual=createHash('sha256').update(await readFile(join(this.root,key))).digest('hex');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new AppError({statusCode:503,code:'LOCAL_STORAGE_READ_FAILED',message:'The local record could not be verified.'});}if(actual!==this.committedHashes.get(key)){this.damaged.add(key);this.records.delete(key);this.summaries.delete(key);throw corrupt(id);}}
 private publish(key:string,record:Record<string,unknown>){this.records.set(key,structuredClone({...record,storageGeneration:record.storageGeneration??this.generation(String(record.user_id))}));if(key.split(/[\\/]/).at(-2)==='buddy')this.summaries.set(key,{value:{id:String(record.id),title:String(record.title),preview:String(record.preview),archived:record.archived===true,pinned_at:typeof record.pinned_at==='string'?record.pinned_at:null,last_message_at:typeof record.last_message_at==='string'?record.last_message_at:null,created_at:String(record.created_at)},search:JSON.stringify(record).toLowerCase()});}
 summaryPage(user:string,options:{page:number;pageSize:number;query:string}){this.available();if(!uuid.test(user))throw new Error('Invalid local account');const prefix=join(user,'buddy')+requireSeparator();const query=options.query.toLowerCase();const rows=[...this.summaries.entries()].filter(([key,item])=>key.startsWith(prefix)&&(!query||item.search.includes(query))).map(([,item])=>item.value).sort((a,b)=>(b.pinned_at??b.last_message_at??b.created_at).localeCompare(a.pinned_at??a.last_message_at??a.created_at));return {conversations:structuredClone(rows.slice((options.page-1)*options.pageSize,options.page*options.pageSize)),total:rows.length,page:options.page,page_size:options.pageSize,pinsAvailable:true};}
 generation(user:string){if(!uuid.test(user))throw new Error('Invalid local account');return this.generations[user]??0;}
 list(user:string,kind:'analysis'|'buddy',strict=false){this.available();if(!uuid.test(user))throw new Error('Invalid local account');const prefix=join(user,kind)+requireSeparator();if(strict){if([...this.retired].some(key=>key.startsWith(prefix)))throw new AppError({statusCode:503,code:'LOCAL_DELETION_RECOVERY_REQUIRED',message:'Earlier local records need recovery before a complete export.'});for(const key of this.damaged)if(key.startsWith(prefix))throw corrupt(key.split(/[\\/]/).at(-1)!.slice(0,-5));}return Array.from(this.records.entries()).filter(([key])=>key.startsWith(prefix)).map(([,value])=>structuredClone(value));}
 users(){this.available();return [...new Set([...this.records.values()].map(x=>String(x.user_id)).concat([...this.damaged,...this.retired].map(key=>key.split(/[\\/]/)[0])))];}
 get(user:string,kind:'analysis'|'buddy',id:string){this.available();const key=this.key(user,kind,id);if(this.damaged.has(key))throw corrupt(id);const record=this.records.get(key);return record?structuredClone(record):undefined;}
 find(user:string,kind:'analysis'|'buddy',field:string,value:string){this.available();if(!uuid.test(user))throw new Error('Invalid local account');const prefix=join(user,kind)+requireSeparator();for(const [key,record] of this.records)if(key.startsWith(prefix)&&record[field]===value)return structuredClone(record);return undefined;}
 private serial<T>(key:string,run:()=>Promise<T>):Promise<T>{const prior=this.tails.get(key)??Promise.resolve();const pending=prior.catch(()=>{}).then(run);this.tails.set(key,pending);void pending.finally(()=>{if(this.tails.get(key)===pending)this.tails.delete(key);}).catch(()=>{});return pending;}
 async accountSnapshot(user:string){await this.ready;return this.serial(user,async()=>{this.list(user,'analysis',true);this.list(user,'buddy',true);for(const key of this.records.keys())if(key.startsWith(user+requireSeparator()))await this.assertCommitted(key,key.split(/[\\/]/).at(-1)!.slice(0,-5));return {analysis:this.list(user,'analysis',true),buddy:this.list(user,'buddy',true)};});}
 async acknowledgeCrisis(user:string,id:string,key:string){
  const generation=this.generation(user);if(!uuid.test(id))throw new Error('Invalid local record identity');await this.ready;
  return this.serial(user,async()=>{this.available();if(generation!==this.generation(user))throw new ConflictError('LOCAL_DATA_DELETED','Local data changed during confirmation.');
   const file=join(this.root,user,'crisis-acknowledgements.json');let rows:Array<{id:string;key:string;confirmedAt:string;kind:string}>=[];
   try{const value:unknown=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(value)||value.some(x=>!x||typeof x.id!=='string'||!uuid.test(x.id)||typeof x.key!=='string'||typeof x.confirmedAt!=='string'||x.kind!=='user_requested_continuation'))throw corrupt(id);rows=value;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   if(!rows.some(x=>x.id===id)){rows.push({id,key,confirmedAt:new Date().toISOString(),kind:'user_requested_continuation'});await mkdir(join(this.root,user),{recursive:true});await writeJsonAtomic(file,rows);}
  });
 }
 async put(kind:'analysis'|'buddy',value:Record<string,unknown>){await this.ready;const user=String(value.user_id),id=String(value.id),key=this.key(user,kind,id),generation=Number(value.storageGeneration??this.generation(user));return this.serial(user,async()=>{
  this.available();if(generation!==this.generation(user))throw new ConflictError('LOCAL_DATA_DELETED','Local data changed while the operation was running.');if(this.damaged.has(key))throw corrupt(id);
  const prior=this.records.get(key);
  await this.assertCommitted(key,id);
  if(prior&&Number(value.storageRevision??0)!==Number(prior.storageRevision??0))throw new ConflictError('LOCAL_RECORD_CHANGED','The saved record changed. Reload and retry.');
  const validate=this.validators.get(kind);const record={...(validate?validate(value):value),schemaVersion:1,storageGeneration:generation,storageRevision:Number(prior?.storageRevision??0)+1};
  await mkdir(join(this.root,user,kind),{recursive:true});const hash=await writeJsonAtomic(join(this.root,key),record);this.committedHashes.set(key,hash);this.publish(key,record);return structuredClone(record);
 });}
 async mutate(kind:'analysis'|'buddy',user:string,id:string,change:(current:Record<string,unknown>)=>Record<string,unknown>){await this.ready;const key=this.key(user,kind,id);return this.serial(user,async()=>{
  this.available();if(this.damaged.has(key))throw corrupt(id);const current=this.records.get(key);if(!current)throw new ConflictError('LOCAL_DATA_DELETED','The local record was removed.');
  await this.assertCommitted(key,id);
  const updated=change(structuredClone(current));if(updated.id!==id||updated.user_id!==user)throw new Error('Local ownership mismatch');
  const validate=this.validators.get(kind);const record={...(validate?validate(updated):updated),schemaVersion:1,storageGeneration:this.generation(user),storageRevision:Number(current.storageRevision??0)+1};
  const hash=await writeJsonAtomic(join(this.root,key),record);this.committedHashes.set(key,hash);this.publish(key,record);return structuredClone(record);
 });}
 async remove(user:string,kind:'analysis'|'buddy',id:string){await this.ready;const key=this.key(user,kind,id);return this.serial(user,async()=>{this.available();await unlink(join(this.root,key)).catch(e=>{if(e.code!=='ENOENT')throw e;});this.records.delete(key);this.summaries.delete(key);this.damaged.delete(key);this.committedHashes.delete(key);});}
 async clear(user:string){await this.ready;return this.serial('@deletion',()=>this.serial(user,async()=>{this.available();if([...this.retired].some(key=>key.startsWith(user+requireSeparator())))throw new AppError({statusCode:503,code:'LOCAL_DELETION_RECOVERY_REQUIRED',message:'Earlier deletion needs recovery. Preserved records were not removed automatically.'});const next={...this.generations,[user]:this.generation(user)+1};await writeJsonAtomic(join(this.root,'.deletion-generations.json'),next);this.generations=next;
  const prefix=user+requireSeparator();for(const key of [...this.records.keys(),...this.damaged])if(key.startsWith(prefix)){await unlink(join(this.root,key)).catch(e=>{if(e.code!=='ENOENT')throw e;});this.records.delete(key);this.summaries.delete(key);this.damaged.delete(key);this.committedHashes.delete(key);}
  await unlink(join(this.root,user,'crisis-acknowledgements.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 }));}
 async close(){if(this.closed)return;await this.ready;await Promise.allSettled([...this.tails.values()]);this.closed=true;const file=join(this.root,'.writer.lock');if(await readFile(file,'utf8')===this.owner)await unlink(file);if(repositories.get(resolve(this.root))===this)repositories.delete(resolve(this.root));}
}
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
const repositories=new Map<string,JsonRepository>();
export function jsonRepository(root:string){const path=resolve(root);let repo=repositories.get(path);if(!repo){repo=new JsonRepository(path);repositories.set(path,repo);}return repo;}
