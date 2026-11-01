import type { DashboardInsights } from "@echo/contracts";
export function SavedFaceResults({insights}:{insights?:DashboardInsights}){
 const rows=insights?.facialResults??[];if(!rows.length)return null;
 return <section aria-label="Saved face analysis" className="rounded-2xl border border-border bg-card p-4"><h3 className="font-semibold">Saved facial expression signals</h3><p className="mt-1 text-xs text-muted-foreground">Separate from text emotions. Model scores do not establish how you feel.</p><ul className="mt-3 space-y-2">{rows.map(({journalId,result})=><li key={journalId} className="text-sm"><a className="font-semibold underline" href={'/journal/'+journalId}>{result.status==='available'?result.prediction:'No usable facial result'}</a>{result.generatedAt&&<time className="ml-2 text-xs" dateTime={result.generatedAt}>{new Date(result.generatedAt).toLocaleString()}</time>}</li>)}</ul></section>;
}
