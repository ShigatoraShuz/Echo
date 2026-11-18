import {createHash} from 'node:crypto';
/** Internal only: bind a model input to this journal without storing a text copy. */
export function journalSourceIdentity(journalId:string,body:string){
 return 'journal-text-v1:'+createHash('sha256').update(journalId+'\0'+body,'utf8').digest('hex');
}
export function validJournalSource(value:unknown):value is string {
 return typeof value==='string'&&/^journal-text-v1:[a-f0-9]{64}$/.test(value);
}
export function withoutJournalSource(value:unknown):unknown {
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const {_journalTextIdentity,...result}=value as Record<string,unknown>;
 return result;
}
