import {jsonRepository} from './json-repository.js';
import {readFile} from 'node:fs/promises';
import { join } from "node:path";
import { z } from "zod";
import { facialExpressionResultSchema, analysisStatusSchema, journalAnalysisResultSchema } from "@echo/contracts";
import { randomUUID } from "node:crypto";
import type { AnalysisStatus, FacialAnalysisStatus } from "@echo/contracts";
import { ConflictError, NotFoundError, AppError } from "../../shared/errors/app-error.js";
export interface LocalAnalysisJob {
    id: string;
    user_id: string;
    journal_id: string;
    request_key: string;
    request_hash: string;
    status: AnalysisStatus;
    progress: number;
    waitReason?: "page_inactive"|"buddy_priority"|"gpu_capacity";
    facial_status: FacialAnalysisStatus;
    face_result?: import("@echo/contracts").FacialExpressionResult;
    result_ciphertext: string | null;
    attempts?: number;
    screeningAttempts?:number;
    reviewer?: string;
    decision?: string;
    decisionKey?: string;
    created_at: string;
    updated_at: string;
    approved: number;
    storageGeneration?:number;
}
/** Readable local JSON. Never uploaded. One backend owns the writer lock. */
export class LocalAnalysisStore {
    private repo:ReturnType<typeof jsonRepository>;
    readonly ready:Promise<void>;
    private creationTail:Promise<unknown>=Promise.resolve();
    constructor(readonly path:string){this.repo=jsonRepository(path);this.repo.register('analysis',value=>this.validate(value));this.ready=this.repo.ready;}
    close(){return this.repo.close();}
    users(){return this.repo.users();}
    healthy(){this.rows();return true;}
    generation(user:string){return this.repo.generation(user);}
    private validate(value:unknown){const x=value as Record<string,any>;
      z.object({schemaVersion:z.literal(1),storageGeneration:z.number().int().nonnegative().optional(),storageRevision:z.number().int().nonnegative().optional(),created_at:z.string().datetime(),updated_at:z.string().datetime(),approved:z.union([z.literal(0),z.literal(1)]),progress:z.number().int().min(0).max(100)}).parse(x);
      z.string().uuid().parse(x.user_id);z.string().uuid().parse(x.id);z.string().uuid().parse(x.journal_id);analysisStatusSchema.parse(x.status);
      if(typeof x.request_key!=='string'||typeof x.request_hash!=='string')throw new Error('Invalid local job');
      if(x.face_result)facialExpressionResultSchema.parse(x.face_result);if(x.result)journalAnalysisResultSchema.parse(x.result);return x;
    }
    private decode(x:Record<string,unknown>){return {...x,result_ciphertext:x.result?JSON.stringify(x.result):null} as unknown as LocalAnalysisJob;}
    private rows(){return this.repo.users().flatMap(user=>this.repo.list(user,'analysis').map(x=>this.decode(x)));}
    private async save(x:LocalAnalysisJob){const {result_ciphertext,...rest}=x;await this.repo.put('analysis',{schemaVersion:1,...rest,result:result_ciphertext?journalAnalysisResultSchema.parse(JSON.parse(result_ciphertext)):null});}
    private async update(user:string,id:string,change:(job:LocalAnalysisJob)=>LocalAnalysisJob){return this.repo.mutate('analysis',user,id,raw=>{const {result_ciphertext,...rest}=change(this.decode(raw));return {...rest,result:result_ciphertext?journalAnalysisResultSchema.parse(JSON.parse(result_ciphertext)):null};});}
    get(user: string, id: string) {const record=this.repo.get(user,'analysis',id);return record?this.decode(record):undefined;}
    find(id: string) { return this.rows().find(x => x.id === id); }
    journal(user: string, id: string) {const record=this.repo.find(user,'analysis','journal_id',id);return record?this.decode(record):undefined;}
    replay(user: string, key: string, hash: string) { const record=this.repo.find(user,'analysis','request_key',key);const j=record?this.decode(record):undefined;if (j && j.request_hash !== hash)
        throw new ConflictError('IDEMPOTENCY_CONFLICT', 'Retry content changed.'); return j; }
    create(user: string, journal: string, key: string, hash: string, facial: FacialAnalysisStatus = 'not_requested') {
      const generation=this.generation(user);
      const pending=this.creationTail.catch(()=>{}).then(async()=>{await this.ready;if(generation!==this.generation(user))throw new ConflictError('LOCAL_DATA_DELETED','Local data was cleared before job creation.');return this.createSerialized(user,journal,key,hash,facial);});
      this.creationTail=pending;return pending;
    }
    private async createSerialized(user: string, journal: string, key: string, hash: string, facial: FacialAnalysisStatus) { const old = this.replay(user, key, hash) ?? this.journal(user, journal); if (old)
        return old; if (this.pending().length >= 64)
        throw new AppError({ statusCode: 429, code: 'AI_QUOTA_EXCEEDED', message: 'Local queue is full. The reflection is saved; retry analysis later.' }); const now = new Date().toISOString(), id = randomUUID(); await this.save({ id, user_id: user, journal_id: journal, request_key: key, request_hash: hash, status: 'queued', progress: 0, facial_status: facial, result_ciphertext: null, created_at: now, updated_at: now, approved: 0,storageGeneration:this.generation(user) }); return this.get(user, id)!; }
    async set(user: string, id: string, status: AnalysisStatus, progress: number, result?: string) { const j = this.get(user, id); if (!j || j.status === 'completed')
        return false; await this.update(user,id,current=>current.status==='completed'?current:({ ...current, status, waitReason:status==='waiting_for_provider'?current.waitReason:undefined, progress: Math.max(current.progress, progress), updated_at: new Date().toISOString(), result_ciphertext: result ?? current.result_ciphertext })); return true; }
    pending() { return this.rows().filter(x => !['completed', 'failed', 'cancelled', 'safety_action_required'].includes(x.status)); }
    completed(user: string) { return this.rows().filter(x => x.user_id === user && x.status === 'completed').sort((a, b) => a.created_at.localeCompare(b.created_at)); }
    async remove(user: string, journal: string) { const j = this.journal(user, journal); if (j)
        await this.repo.remove(user,'analysis',j.id); }
    async crisisAcknowledged(user:string,id:string){
      z.string().uuid().parse(user);z.string().uuid().parse(id);
      try{return JSON.parse(await readFile(join(this.path,user,'crisis-acknowledgements.json'),'utf8')).some((x:{id:string})=>x.id===id);}
      catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
    }
    async acknowledgeCrisis(user:string,id:string,key:string){
      z.string().uuid().parse(user);z.string().uuid().parse(id);
      await this.repo.acknowledgeCrisis(user,id,key);
    }
    async confirmContinuation(user:string,id:string,key:string){
      const job=this.get(user,id);if(!job)throw new NotFoundError('Reflection analysis unavailable.');
      const prior=(job as LocalAnalysisJob & {userContinuation?:{key:string}}).userContinuation;
      if(prior?.key===key)return {status:job.status};
      if(job.status!=='safety_action_required')throw new ConflictError('SAFETY_CONFIRMATION_UNAVAILABLE','This reflection is not waiting for confirmation.');
      await this.save({...job,status:'queued',approved:1,updated_at:new Date().toISOString(),userContinuation:{key,confirmedBy:user,confirmedAt:new Date().toISOString(),originalStatus:'safety_action_required',kind:'user_requested_continuation',checklistCompleted:true}} as LocalAnalysisJob);
      return {status:'queued'};
    }
    async review(reviewer: string, user: string, id: string, decision: 'approved_continue' | 'end_analysis', decisionKey?: string) { const j = this.get(user, id); if (j && j.decisionKey === decisionKey && decisionKey && j.reviewer === reviewer && j.decision === decision)
        return { status: j.status, reviewer }; if (!j || j.status !== 'safety_action_required')
        throw new ConflictError('SAFETY_REVIEW_REJECTED', 'Not waiting for review.'); const status = decision === 'approved_continue' ? 'queued' : 'failed'; await this.save({ ...j, approved: 1, status, updated_at: new Date().toISOString(), reviewer, decision, decisionKey } as LocalAnalysisJob); return { status, reviewer }; }
    handoff(user: string, id: string) { if (!this.get(user, id)?.result_ciphertext)
        throw new NotFoundError('Result unavailable.'); return { handoffId: id, expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() }; }
    readHandoff(user: string, id: string) { const j = this.get(user, id); const expires = j ? new Date(Date.parse(j.created_at) + 90 * 86400000).toISOString() : ''; return j?.result_ciphertext && expires > new Date().toISOString() ? { job_id: id, expires_at: expires } : undefined; }
    async retry(user: string, id: string) { const j = this.get(user, id); if (!j || j.status !== 'failed' || (j.attempts ?? 0) >= 3)
        throw new ConflictError('RETRY_LIMIT', 'Local analysis retry is unavailable.'); await this.save({ ...j, status: 'queued', attempts: (j.attempts ?? 0) + 1 }); }
    async export(user: string) { return (await this.repo.accountSnapshot(user)).analysis; }
    exportAccount(user:string){return this.repo.accountSnapshot(user);}
    async reserveScreening(user:string,id:string){await this.update(user,id,j=>{if(j.status!=='completed'||(j.screeningAttempts??0)>=3)throw new ConflictError('RETRY_LIMIT','Screening retry unavailable.');return {...j,screeningAttempts:(j.screeningAttempts??0)+1};});}
    async replaceScreening(user:string,id:string,result:unknown){if(this.get(user,id))await this.update(user,id,j=>({...j,result_ciphertext:JSON.stringify(journalAnalysisResultSchema.parse(result)),updated_at:new Date().toISOString()}));}
    async wait(user:string,id:string,reason:'page_inactive'|'buddy_priority'|'gpu_capacity'){const job=this.get(user,id);if(job&&!(job.status==='waiting_for_provider'&&job.waitReason===reason)&&!['completed','failed','cancelled','safety_action_required'].includes(job.status))await this.update(user,id,j=>['completed','failed','cancelled','safety_action_required'].includes(j.status)?j:({...j,status:'waiting_for_provider',waitReason:reason,updated_at:new Date().toISOString()}));}
    async setFace(user:string,id:string,status:FacialAnalysisStatus,result?:unknown){if(this.get(user,id))await this.update(user,id,j=>({...j,facial_status:status,...(result?{face_result:facialExpressionResultSchema.parse(result)}:{}),updated_at:new Date().toISOString()}));}
    async clear(user: string) {await this.repo.clear(user);}
}
