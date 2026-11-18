import {it,expect} from 'vitest';
import {compareJournalSignals} from '../../src/features/journals/journal-signal-comparison.js';
import {journalSourceIdentity} from '../../src/features/journals/journal-source-identity.js';
const base={journalId:'40000000-0000-4000-8000-000000000001',revision:'2026-11-05T00:00:00+00:00',textTime:'2026-11-05T00:00:01Z',textId:'text-result',textEmotion:'sadness',face:{schemaVersion:'echo-face-expression-v1',status:'available',experimental:true,prediction:'joy',scoreType:'uncalibrated_class_probability',classProbabilities:{joy:.125,trust:.125,fear:.125,surprise:.125,sadness:.125,disgust:.125,anger:.125,anticipation:.125},quality:{},modelFingerprint:'a'.repeat(64),inferenceVersion:'test',generatedAt:'2026-11-05T00:00:02Z'}} as const;
it('compares leading labels without interpreting or combining model scores',()=>{
 const source=journalSourceIdentity(base.journalId,'Original journal text.');
 const input={...base,currentSource:source,textSource:source,faceSource:source};
 expect(compareJournalSignals(input)).toMatchObject({status:'different',textEmotion:'sadness',faceEmotion:'joy',journalId:base.journalId,textResultId:'text-result'});
 expect(compareJournalSignals({...input,textEmotion:'joy'}).status).toBe('same');
 expect(JSON.stringify(compareJournalSignals(input))).not.toContain(source);
});
it('missing and legacy labels do not create a discrepancy',()=>{
 for(const textEmotion of [null,'calm','neutral'])expect(compareJournalSignals({...base,textEmotion})).toMatchObject({status:'unavailable',reason:'missing_signal',textState:'missing'});
 expect(compareJournalSignals({...base,face:null}).status).toBe('unavailable');
});
it('allows metadata timestamps to change but rejects changed text',()=>{
 const source=journalSourceIdentity(base.journalId,'Original journal text.');
 const input={...base,currentSource:source,textSource:source,faceSource:source};
 expect(compareJournalSignals({...input,revision:'2026-11-06T00:00:00Z',textTime:undefined}).status).toBe('different');
 expect(compareJournalSignals({...input,currentSource:journalSourceIdentity(base.journalId,'Edited journal text.')})).toMatchObject({status:'unavailable',reason:'stale_revision',textState:'stale',faceState:'stale'});
});
it('identifies unverifiable legacy signals and the one signal needing refresh',()=>{
 const source=journalSourceIdentity(base.journalId,'Original journal text.');
 expect(compareJournalSignals(base)).toMatchObject({status:'unavailable',textState:'unverified',faceState:'unverified'});
 expect(compareJournalSignals({...base,currentSource:source,textSource:source})).toMatchObject({status:'unavailable',textState:'current',faceState:'unverified'});
 expect(compareJournalSignals({...base,currentSource:source,textSource:source,faceSource:journalSourceIdentity('another-journal','Original journal text.')})).toMatchObject({status:'unavailable',faceState:'stale'});
});
