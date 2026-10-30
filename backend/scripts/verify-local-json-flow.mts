import { createDisposableDatabase } from './disposable-database.mjs';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { JournalService } from '../src/features/journals/journals.service.js';
import { ExperienceService } from '../src/features/experience/experience.service.js';
import { LocalAnalysisStore } from '../src/infrastructure/analysis/local-analysis-store.js';
import { LocalBuddyStore } from '../src/infrastructure/analysis/local-buddy-store.js';
import { createEncryptionService } from '../src/infrastructure/encryption/encryption.service.js';
import { IdempotencyService } from '../src/infrastructure/idempotency/idempotency.service.js';
export async function verifyLocalFlow(core: any) {
    const db = await createDisposableDatabase();
    const fixture = await readFile(new URL('../../supabase/tests/database/journal-analysis-transactions.test.sql', import.meta.url), 'utf8');
    await db.exec(fixture.slice(0, fixture.indexOf('create temp table test_jobs')) + 'commit;');
    const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const root = fileURLToPath(new URL('../../../runtime-cache/local-json-flow/', import.meta.url));
    await mkdir(root, { recursive: true });
    const dir = await mkdtemp(root + 'run-');
    let store = new LocalAnalysisStore(dir);
    const buddy = new LocalBuddyStore(dir);
    const writes: string[] = [];
    const ident = (x: string) => { assert.match(x, /^[a-z_]+$/); return x; };
    const client: any = { schema(schema: string) { ident(schema); return { async rpc(name: string, args: Record<string, unknown>) { ident(name); if (name.startsWith('submit_')) {
                assert.equal(args.p_analysis_requested, false);
                assert.equal(args.p_processing_mode, 'disabled');
                writes.push(name);
            } const entries = Object.entries(args), params = entries.map(([k], i) => ident(k) + ' => $' + (i + 1)); try {
                const table = name.startsWith('submit_');
                const result = await db.query(`select ${table ? '* from ' : ''}${schema}.${name}(${params.join(',')}) ${table ? '' : 'as value'}`, entries.map(([, v]) => Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : v));
                return { data: table ? result.rows : result.rows[0]?.value, error: null };
            }
            catch (e) {
                return { data: null, error: { message: String(e) } };
            } }, from(table: string) { ident(table); const values: unknown[] = [], filters: string[] = []; let columns = '*', lim = '', order = ''; const query: any = { select(c: string) { columns = c; assert.match(c, /^[a-z0-9_*,]+$/); return query; }, eq(k: string, v: unknown) { values.push(v); filters.push(ident(k) + '=$' + values.length); return query; }, gt(k: string, v: unknown) { values.push(v); filters.push(ident(k) + '>$' + values.length); return query; }, is(k: string, v: unknown) { assert.equal(v, null); filters.push(ident(k) + ' is null'); return query; }, order(k: string, opts: any) { order = 'order by ' + ident(k) + (opts?.ascending === false ? ' desc' : ' asc'); return query; }, limit(n: number) { lim = 'limit ' + Number(n); return query; }, async maybeSingle() { const r = await query; return { ...r, data: r.data?.[0] ?? null }; }, then(resolve: any, reject: any) { return db.query(`select ${columns} from ${schema}.${table} ${filters.length ? 'where ' + filters.join(' and ') : ''} ${order} ${lim}`, values).then(r => resolve({ data: r.rows, error: null }), reject); } }; return query; } }; } };
    const encryption = createEncryptionService(Buffer.alloc(32, 8).toString('base64'), 1);
    const journals = new JournalService(client, encryption, {} as any, new IdempotencyService('v1', { v1: 'synthetic-secret-at-least-32-characters' }), { mode: 'local_json', developmentUserIds: new Set(), timeoutMs: 300000 }, undefined, undefined, undefined, store, core);
    const experience = new ExperienceService(client, journals, encryption, undefined, undefined, core, buddy);
    const verification: any = { assertAiAccess: async () => { } };
    const verifier: any = { getUser: async () => ({ id: user, email: 'synthetic@example.invalid' }) };
    const app = createApp({ v1: { journals: { service: journals, verifier, verificationService: verification }, experience: { service: experience, verifier, verificationService: verification } } });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as any;
    const base = 'http://127.0.0.1:' + address.port + '/api/v1';
    const headers = { Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json' };
    try {
        for (const [i, text] of ['I enjoyed a quiet walk with a friend.', 'Masaya ako sa tahimik na araw kasama ang kaibigan.', 'Okay naman today, I enjoyed walking with my friend.'].entries()) {
            const res = await fetch(base + '/journals', { method: 'POST', headers: { ...headers, 'Idempotency-Key': 'synthetic-local-request-' + i }, body: JSON.stringify({ title: 'Synthetic reflection', body: text, mood: 'calm', tags: [], emotions: [], privacyStatus: 'private', analysisConsent: false, facialAnalysisRequested: false }) });
            const payload = await res.json();
            assert.equal(res.status, 202, JSON.stringify(payload));
            const job = payload.data;
            const deadline = Date.now() + 180000;
            while (!['completed', 'failed', 'safety_action_required'].includes(store.get(user, job.analysisJobId)!.status) && Date.now() < deadline)
                await new Promise(r => setTimeout(r, 250));
            assert.equal(store.get(user, job.analysisJobId)?.status, 'completed');
            const detail = await fetch(base + '/journals/' + job.journalId + '/analyses', { headers });
            assert.equal(detail.status, 200);
            assert.ok(['echo-journal-analysis-v2','echo-journal-analysis-v3'].includes((await detail.json()).data.result.schemaVersion));
        }
        if(process.env.ECHO_VERIFY_PHQ_ONLY==='true'){
            const completed=store.completed(user);assert.equal(completed.length,3);
            const first=completed[0];const before=JSON.parse(first.result_ciphertext!);assert.equal(before.schemaVersion,'echo-journal-analysis-v3');assert.equal(before.journalScreening.status,'available');
            const retried=await fetch(base+'/journals/'+first.journal_id+'/screening/retry',{method:'POST',headers});assert.equal(retried.status,200,await retried.text());
            const after=JSON.parse(store.get(user,first.id)!.result_ciphertext!);assert.deepEqual(after.categoryScores,before.categoryScores);assert.deepEqual(after.emotionDistribution,before.emotionDistribution);assert.equal(after.journalScreening.status,'available');
            assert.equal(Number((await db.query('select count(*) n from ai_analysis.analysis_results')).rows[0].n),0);assert.equal(Number((await db.query('select count(*) n from ai_analysis.analysis_requests')).rows[0].n),0);
            store.close();store=new LocalAnalysisStore(dir);assert.equal(store.completed(user).length,3);console.info('PASS actual nullable PHQ-8 through Express, disposable encrypted journal saves, JSON persistence, screening-only retry and reload; zero database analysis records');return;
        }
        const response = await fetch(base + '/buddy/messages', { method: 'POST', headers, body: JSON.stringify({ content: 'I feel stressed about homework. Can we choose one small step?' }) });
        const conversation = await response.json();
        assert.equal(response.status, 201, JSON.stringify(conversation));
        assert.ok(conversation.data.messages.at(-1).content);
        if(process.env.ECHO_VERIFY_VOICE==='true'){
            const text=conversation.data.messages.at(-1).content;
            const denied=await fetch(base+'/buddy/voice/speak',{method:'POST',headers,body:JSON.stringify({text:'Not an approved reply'})});assert.equal(denied.status,403);
            const spoken=await fetch(base+'/buddy/voice/speak',{method:'POST',headers,body:JSON.stringify({text}),signal:AbortSignal.timeout(315000)});assert.equal(spoken.status,200);const wav=Buffer.from(await spoken.arrayBuffer());assert.equal(wav.subarray(0,4).toString(),'RIFF');
            const transcript=await fetch(base+'/buddy/voice/transcribe',{method:'POST',headers:{Authorization:headers.Authorization,'Content-Type':'application/octet-stream'},body:wav,signal:AbortSignal.timeout(315000)});assert.equal(transcript.status,200);const parsed=await transcript.json();assert.equal(typeof parsed.data.text,'string');assert.ok(parsed.data.text.trim());console.info('PASS owned default-voice WAV -> local Whisper through authenticated Express');
        }
        const id = conversation.data.conversationId;
        assert.ok(new LocalBuddyStore(dir).get(user, id).messages.length >= 2);
        assert.equal(Number((await db.query('select count(*) n from ai_analysis.analysis_results')).rows[0].n), 0);
        assert.equal(Number((await db.query('select count(*) n from ai_analysis.analysis_requests')).rows[0].n), 0);
        assert.equal(Number((await db.query('select count(*) n from buddy_service.buddy_messages')).rows[0].n), 0);
        store.close();
        store = new LocalAnalysisStore(dir);
        assert.equal(store.completed(user).length, 3);
        console.info('PASS Express + disposable SQL journal saves + actual English/Filipino/Taglish models + readable JSON + Buddy reopen; no cloud analysis/Buddy records');
    }
    finally {
        store.close();
        server.close();
        await db.close();
    }
}
