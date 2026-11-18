import {journalSignalComparisonSchema,plutchikEmotionSchema,type FacialExpressionResult,type JournalSignalComparison} from '@echo/contracts';
import {validJournalSource} from './journal-source-identity.js';
/** Label agreement only; scores from independent models are never fused. */
export function compareJournalSignals(input:{journalId:string;revision:string;textEmotion:string|null;textTime:string|undefined;textId?:string;face:FacialExpressionResult|null;currentSource?:string;textSource?:string;faceSource?:string}):JournalSignalComparison{
 const text=plutchikEmotionSchema.safeParse(input.textEmotion),face=input.face;
 const state=(available:boolean,source?:string)=>!available?'missing' as const:!validJournalSource(source)||!validJournalSource(input.currentSource)?'unverified' as const:source!==input.currentSource?'stale' as const:'current' as const;
 const textState=state(text.success,input.textSource),faceState=state(face?.status==='available',input.faceSource);
 const labels={...(text.success?{textEmotion:text.data}:{}),...(face?.status==='available'?{faceEmotion:face.prediction}:{})};
 if(!text.success||face?.status!=='available')return {status:'unavailable',reason:'missing_signal',textState,faceState,...labels};
 if(textState!=='current'||faceState!=='current')return {status:'unavailable',reason:'stale_revision',textState,faceState,...labels};
 return journalSignalComparisonSchema.parse({status:text.data===face.prediction?'same':'different',textEmotion:text.data,faceEmotion:face.prediction,journalId:input.journalId,journalRevision:input.revision,textResultId:input.textId,faceResultId:face.modelFingerprint+':'+face.generatedAt});
}
