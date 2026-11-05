import {it,expect} from 'vitest';
import {compareJournalSignals} from '../../src/features/journals/journal-signal-comparison.js';
const base={journalId:'40000000-0000-4000-8000-000000000001',revision:'2026-11-05T00:00:00+00:00',textTime:'2026-11-05T00:00:01Z',textId:'text-result',textEmotion:'sadness',face:{schemaVersion:'echo-face-expression-v1',status:'available',experimental:true,prediction:'joy',scoreType:'uncalibrated_class_probability',classProbabilities:{joy:.125,trust:.125,fear:.125,surprise:.125,sadness:.125,disgust:.125,anger:.125,anticipation:.125},quality:{},modelFingerprint:'a'.repeat(64),inferenceVersion:'test',generatedAt:'2026-11-05T00:00:02Z'}} as const;
it('compares leading labels without interpreting or combining model scores',()=>{
 expect(compareJournalSignals(base)).toMatchObject({status:'different',textEmotion:'sadness',faceEmotion:'joy',journalId:base.journalId,textResultId:'text-result'});
 expect(compareJournalSignals({...base,textEmotion:'joy'}).status).toBe('same');
});
it('missing and legacy labels do not create a discrepancy',()=>{
 for(const textEmotion of [null,'calm','neutral'])expect(compareJournalSignals({...base,textEmotion})).toEqual({status:'unavailable',reason:'missing_signal'});
 expect(compareJournalSignals({...base,face:null}).status).toBe('unavailable');
});
it('refuses comparison across a newer journal revision or unverifiable timestamps',()=>{
 expect(compareJournalSignals({...base,revision:'2026-11-06T00:00:00Z'})).toEqual({status:'unavailable',reason:'stale_revision'});
 expect(compareJournalSignals({...base,textTime:undefined}).status).toBe('unavailable');
 expect(compareJournalSignals({...base,face:{...base.face,generatedAt:'2026-11-04T00:00:00Z'}}).status).toBe('unavailable');
});
