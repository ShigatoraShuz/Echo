import {journalSignalComparisonSchema,plutchikEmotionSchema,type FacialExpressionResult,type JournalSignalComparison} from '@echo/contracts';
/** Label agreement only; scores from independent models are never fused. */
export function compareJournalSignals(input:{journalId:string;revision:string;textEmotion:string|null;textTime:string|undefined;textId?:string;face:FacialExpressionResult|null}):JournalSignalComparison{
 const text=plutchikEmotionSchema.safeParse(input.textEmotion),face=input.face;
 if(!text.success||face?.status!=='available')return {status:'unavailable',reason:'missing_signal'};
 const times=[input.revision,input.textTime,face.generatedAt].map(value=>Date.parse(value??''));
 if(times.some(value=>!Number.isFinite(value))||times[1]<times[0]||times[2]<times[0])return {status:'unavailable',reason:'stale_revision'};
 return journalSignalComparisonSchema.parse({status:text.data===face.prediction?'same':'different',textEmotion:text.data,faceEmotion:face.prediction,journalId:input.journalId,journalRevision:input.revision,textResultId:input.textId,faceResultId:face.modelFingerprint+':'+face.generatedAt});
}
