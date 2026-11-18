"use client";
import {journalPhq8Reading,phq8ReadingLabel} from '@echo/contracts';
import {Phq8Meter} from '@/shared/components/phq8-meter';
type Estimate={status:string;coverage:number;subtotal:number|null;total:number|null;generatedAt?:string};
export function JournalPhq8Meter({estimate}:{estimate?:Estimate}){
  const reading=estimate?journalPhq8Reading(estimate):{kind:'unavailable'} as const;
  const label=phq8ReadingLabel(reading);
  const coverage=estimate?.coverage??0;
  return <section aria-label="Journal PHQ8 meter" className="my-3 rounded-2xl border border-primary/15 bg-secondary/25 p-4">
    <h3 className="font-semibold">Journal-based PHQ8 estimate</h3>
    <Phq8Meter reading={reading} label={`Journal-based PHQ8 estimate: ${label}${coverage?' · '+coverage+'/8 items estimated':''}`}/>
    <p className="text-center text-lg font-semibold capitalize">{label}</p>
    {estimate&&<p className="text-center text-sm">{coverage}/8 items estimated</p>}
    {reading.kind==='unavailable'&&<p className="mt-2 text-sm">{estimate?.status==='failed'?'Journal estimate failed.':coverage===0?'No criteria evidenced in this entry.':'No usable journal estimate is available.'}</p>}
    {estimate?.generatedAt&&<p className="mt-2 text-xs">Estimated on {new Date(estimate.generatedAt).toLocaleString()}</p>}
    <p className="mt-2 text-xs text-muted-foreground">Experimental journal estimate, separate from your self-reported check-in. Missing evidence stays unknown; a partial range is not a diagnosis or a completed PHQ8 score.</p>
  </section>;
}
