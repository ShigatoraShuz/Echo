"use client";
export function JournalDeepAnalysisToggle({checked,onChange}:{checked:boolean;onChange:(value:boolean)=>void}){
  return <label className="my-3 flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
    <input type="checkbox" role="switch" aria-label="Deep analysis" checked={checked} onChange={event=>onChange(event.target.checked)} className="peer sr-only"/>
    <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-secondary transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"/>
    <span>Deep analysis <span className="block text-xs font-normal text-muted-foreground">Add journal distress details</span></span>
  </label>;
}
