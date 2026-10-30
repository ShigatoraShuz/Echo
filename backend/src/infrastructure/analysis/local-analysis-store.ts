import { openSync, closeSync, fsyncSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { analysisStatusSchema, journalAnalysisResultSchema } from "@echo/contracts";
import { mkdirSync } from "node:fs";
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
    facial_status: FacialAnalysisStatus;
    result_ciphertext: string | null;
    attempts?: number;
    screeningAttempts?:number;
    reviewer?: string;
    decision?: string;
    decisionKey?: string;
    created_at: string;
    updated_at: string;
    approved: number;
}
/** Readable local JSON. Never uploaded. One backend owns the writer lock. */
export class LocalAnalysisStore {
    private lock: number;
    constructor(readonly path: string) { mkdirSync(path, { recursive: true }); const lock = join(path, '.writer.lock'); try {
        this.lock = openSync(lock, 'wx');
    }
    catch (error) {
        const pid = Number(readFileSync(lock, 'utf8'));
        if (!Number.isSafeInteger(pid) || pid <= 0)
            throw error;
        try {
            process.kill(pid, 0);
            throw error;
        }
        catch (probe) {
            if ((probe as NodeJS.ErrnoException).code !== 'ESRCH')
                throw error;
        }
        unlinkSync(lock);
        this.lock = openSync(lock, 'wx');
    } writeFileSync(this.lock, String(process.pid)); try {
        this.rows();
    }
    catch (error) {
        this.close();
        throw error;
    } }
    close() { closeSync(this.lock); unlinkSync(join(this.path, '.writer.lock')); }
    users() { return readdirSync(this.path).filter(x => z.string().uuid().safeParse(x).success); }
    healthy() { this.rows(); const f = join(this.path, '.probe'); writeFileSync(f, 'ok'); unlinkSync(f); return true; }
    private file(user: string, id: string) { z.string().uuid().parse(user); z.string().uuid().parse(id); const dir = join(this.path, user, 'analysis'); mkdirSync(dir, { recursive: true }); return join(dir, id + '.json'); }
    private rows() { return readdirSync(this.path, { recursive: true }).map(String).filter(f => f.endsWith('.json') && f.split(/[\\/]/).at(-2) === 'analysis').map(f => { const x = JSON.parse(readFileSync(join(this.path, f), 'utf8'));
            z.object({schemaVersion:z.literal(1),created_at:z.string().datetime(),updated_at:z.string().datetime(),approved:z.union([z.literal(0),z.literal(1)]),progress:z.number().int().min(0).max(100)}).parse(x); z.string().uuid().parse(x.user_id); z.string().uuid().parse(x.id); z.string().uuid().parse(x.journal_id); if (f.split(/[\\/]/)[0] !== x.user_id || f.split(/[\\/]/).at(-1) !== x.id + '.json')
        throw Error('Local ownership mismatch'); analysisStatusSchema.parse(x.status); if (typeof x.request_key !== 'string' || typeof x.request_hash !== 'string' || !Number.isFinite(x.progress))
        throw Error('Invalid local job'); if (x.result)
        journalAnalysisResultSchema.parse(x.result); return { ...x, result_ciphertext: x.result ? JSON.stringify(x.result) : null } as LocalAnalysisJob; }); }
    private save(x: LocalAnalysisJob) { const f = this.file(x.user_id, x.id), tmp = f + '.' + randomUUID() + '.tmp'; const { result_ciphertext, ...rest } = x; const fd = openSync(tmp, 'wx'); try {
        writeFileSync(fd, JSON.stringify({ schemaVersion: 1, ...rest, result: result_ciphertext ? journalAnalysisResultSchema.parse(JSON.parse(result_ciphertext)) : null }, null, 2));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    } renameSync(tmp, f); }
    get(user: string, id: string) { return this.rows().find(x => x.user_id === user && x.id === id); }
    find(id: string) { return this.rows().find(x => x.id === id); }
    journal(user: string, id: string) { return this.rows().find(x => x.user_id === user && x.journal_id === id); }
    replay(user: string, key: string, hash: string) { const j = this.rows().find(x => x.user_id === user && x.request_key === key); if (j && j.request_hash !== hash)
        throw new ConflictError('IDEMPOTENCY_CONFLICT', 'Retry content changed.'); return j; }
    create(user: string, journal: string, key: string, hash: string, facial: FacialAnalysisStatus = 'not_requested') { const old = this.replay(user, key, hash) ?? this.journal(user, journal); if (old)
        return old; if (this.pending().length >= 64)
        throw new AppError({ statusCode: 429, code: 'AI_QUOTA_EXCEEDED', message: 'Local queue is full. The reflection is saved; retry analysis later.' }); const now = new Date().toISOString(), id = randomUUID(); this.save({ id, user_id: user, journal_id: journal, request_key: key, request_hash: hash, status: 'queued', progress: 0, facial_status: facial, result_ciphertext: null, created_at: now, updated_at: now, approved: 0 }); return this.get(user, id)!; }
    set(user: string, id: string, status: AnalysisStatus, progress: number, result?: string) { const j = this.get(user, id); if (!j || j.status === 'completed')
        return false; this.save({ ...j, status, progress: Math.max(j.progress, progress), updated_at: new Date().toISOString(), result_ciphertext: result ?? j.result_ciphertext }); return true; }
    pending() { return this.rows().filter(x => !['completed', 'failed', 'safety_action_required'].includes(x.status)); }
    completed(user: string) { return this.rows().filter(x => x.user_id === user && x.status === 'completed').sort((a, b) => a.created_at.localeCompare(b.created_at)); }
    remove(user: string, journal: string) { const j = this.journal(user, journal); if (j)
        unlinkSync(this.file(user, j.id)); }
    review(reviewer: string, user: string, id: string, decision: 'approved_continue' | 'end_analysis', decisionKey?: string) { const j = this.get(user, id); if (j && j.decisionKey === decisionKey && decisionKey && j.reviewer === reviewer && j.decision === decision)
        return { status: j.status, reviewer }; if (!j || j.status !== 'safety_action_required')
        throw new ConflictError('SAFETY_REVIEW_REJECTED', 'Not waiting for review.'); const status = decision === 'approved_continue' ? 'queued' : 'failed'; this.save({ ...j, approved: 1, status, updated_at: new Date().toISOString(), reviewer, decision, decisionKey } as LocalAnalysisJob); return { status, reviewer }; }
    handoff(user: string, id: string) { if (!this.get(user, id)?.result_ciphertext)
        throw new NotFoundError('Result unavailable.'); return { handoffId: id, expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() }; }
    readHandoff(user: string, id: string) { const j = this.get(user, id); const expires = j ? new Date(Date.parse(j.created_at) + 90 * 86400000).toISOString() : ''; return j?.result_ciphertext && expires > new Date().toISOString() ? { job_id: id, expires_at: expires } : undefined; }
    retry(user: string, id: string) { const j = this.get(user, id); if (!j || j.status !== 'failed' || (j.attempts ?? 0) >= 3)
        throw new ConflictError('RETRY_LIMIT', 'Local analysis retry is unavailable.'); this.save({ ...j, status: 'queued', attempts: (j.attempts ?? 0) + 1 }); }
    export(user: string) { z.string().uuid().parse(user); return this.rows().filter(x => x.user_id === user).map(({ result_ciphertext, ...x }) => ({ ...x, result: result_ciphertext ? JSON.parse(result_ciphertext) : null })); }
    reserveScreening(user:string,id:string){const j=this.get(user,id);if(!j||j.status!=='completed'||(j.screeningAttempts??0)>=3)throw new ConflictError('RETRY_LIMIT','Screening retry unavailable.');this.save({...j,screeningAttempts:(j.screeningAttempts??0)+1});}
    replaceScreening(user:string,id:string,result:unknown){const j=this.get(user,id);if(j)this.save({...j,result_ciphertext:JSON.stringify(journalAnalysisResultSchema.parse(result)),updated_at:new Date().toISOString()});}
    clear(user: string) { for (const j of this.rows().filter(x => x.user_id === user))
        this.remove(user, j.journal_id); }
}
