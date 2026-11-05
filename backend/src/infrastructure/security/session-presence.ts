import {createHash} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {atomicJson} from '../analysis/atomic-json.js';

type RecordState={version:1;tabs:Record<string,number>;emptySince:number|null;closed:boolean};
/** No tokens, journal data or raw session identifiers are persisted. */
export class SessionPresenceStore {
 constructor(private root:string,private now:()=>number=Date.now){}
 private file(user:string,session:string){return join(this.root,createHash('sha256').update(user+'\0'+session).digest('hex')+'.json');}
 private read(user:string,session:string):RecordState|null{
  const file=this.file(user,session);if(!existsSync(file))return null;
  const row=JSON.parse(readFileSync(file,'utf8')) as RecordState;
  if(row.version!==1||typeof row.closed!=='boolean'||!row.tabs||typeof row.tabs!=='object'||(row.emptySince!==null&&!Number.isFinite(row.emptySince))||Object.values(row.tabs).some(t=>!Number.isFinite(t)))throw Error('Invalid session-presence record');
  return row;
 }
 private save(user:string,session:string,row:RecordState){mkdirSync(this.root,{recursive:true});atomicJson(this.file(user,session),row);}
 private expire(row:RecordState){
  const now=this.now();const times=Object.values(row.tabs);
  for(const [tab,last] of Object.entries(row.tabs))if(now-last>=90000)delete row.tabs[tab];
  if(!Object.keys(row.tabs).length&&row.emptySince===null)row.emptySince=times.length?Math.max(...times)+90000:now;
  if(row.emptySince!==null&&now-row.emptySince>=30000)row.closed=true;
 }
 isClosed(user:string,session:string){const row=this.read(user,session);if(!row)return false;this.expire(row);this.save(user,session,row);return row.closed;}
 update(user:string,session:string,tab:string,action:'register'|'heartbeat'|'release'|'logout'){
  const row=this.read(user,session)??{version:1,tabs:{},emptySince:null,closed:false};this.expire(row);
  if(row.closed)return {closed:true};
  if(action==='logout'){row.closed=true;row.tabs={};}
  else if(action==='release'){delete row.tabs[tab];if(!Object.keys(row.tabs).length&&row.emptySince===null)row.emptySince=this.now();}
  else {row.tabs[tab]=this.now();row.emptySince=null;}
  this.save(user,session,row);return {closed:row.closed};
 }
}
