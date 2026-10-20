import { BookOpen, ShieldCheck } from "lucide-react";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { ProfessionalNotice, ProfessionalPanel } from "./professional-ui";

export type PreviewConsentState = "active" | "expired" | "revoked" | "unavailable";

/** The real API supplies only sharingActive. Detailed reasons are synthetic preview inputs only. */
export function ProfessionalCaseSharing({ detail, previewState }: { detail: CaseDetail; previewState?: PreviewConsentState }) {
  const active = detail.request.sharingActive === true && (!previewState || previewState === "active");
  const title = active ? "Active sharing" : previewState === "expired" ? "Sharing expired" : previewState === "revoked" ? "Sharing revoked" : "Sharing is unavailable";
  return <div className="space-y-6">
    <ProfessionalPanel title="What the user shared" icon={ShieldCheck} description="Only the message and snapshots included in this authorized case response.">
      <ProfessionalNotice title={title}>
        {active ? "The current response permits access to the shared message and selected journal snapshots." : "The user stopped sharing or this grant expired. Their message and selected journal snapshots are unavailable."}
        {!active && !previewState ? " The service does not disclose the reason or expiry date." : ""}
        {previewState ? " Synthetic consent scenario only." : ""}
      </ProfessionalNotice>
      {active ? <div className="mt-5">
        <p className="break-words whitespace-pre-wrap text-sm leading-7">{detail.request.summary || "No shared message is available."}</p>
        <p className="mt-5 break-words rounded-xl border border-border/70 bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">Preferred time: {detail.request.preferredTime || "Not specified"}</p>
      </div> : null}
      <p className="mt-4 text-xs leading-6 text-muted-foreground">Sharing is checked when the case is loaded. Refresh to check again. Restricted case notes and appointment records follow separate professional access rules.</p>
    </ProfessionalPanel>
    <ProfessionalPanel title="Selected journal snapshots" icon={BookOpen} description="Copies selected by the user for this request. Original journals are never fetched here.">
      {active ? detail.sharedJournals.length ? <div className="space-y-3">{detail.sharedJournals.map((item) => <details key={item.journalId} className="rounded-2xl border border-border bg-background p-4">
        <summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center break-words rounded-lg text-sm font-semibold text-primary">{item.title || "Untitled reflection"}</summary>
        <p className="mt-4 break-words whitespace-pre-wrap text-sm leading-7">{item.body}</p>
      </details>)}</div> : <p className="text-sm text-muted-foreground">No journal snapshots were included in this response.</p> : <p className="text-sm text-muted-foreground">Shared journal contents are inaccessible.</p>}
      <p className="mt-4 text-xs leading-6 text-muted-foreground">Only explicitly selected snapshots are included; original assessment records are not fetched here.</p>
    </ProfessionalPanel>
    {active && (detail.sharedPhq8 ?? []).length > 0 ? <ProfessionalPanel title="Selected PHQ-8 snapshots" icon={ShieldCheck} description="Check-ins explicitly shared by the user for this case; not a diagnosis.">
      <div className="space-y-3">{detail.sharedPhq8.map((item) => <article key={item.id} className="rounded-2xl border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">{item.label}</h3><p className="mt-2 text-sm">Score: {item.score} / 24 - {item.severity}</p>
        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{item.context}</p>
      </article>)}</div>
    </ProfessionalPanel> : null}
  </div>;
}
