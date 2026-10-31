import { History } from "lucide-react";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { caseActivity } from "../professional-case.model";
import { requestDate } from "../professional-request.model";
import { ProfessionalPanel } from "./professional-ui";

export function ProfessionalCaseTimeline({ detail, loading = false }: { detail: CaseDetail; loading?: boolean }) {
  const events = loading ? [] : caseActivity(detail);
  return <ProfessionalPanel title="Case activity" icon={History} description={detail.timeline ? (detail.timeline.hasMore ? `Latest ${detail.timeline.limit} recorded case actions, oldest first. Earlier activity is not included.` : "Recorded case actions, oldest first. Access logs and internal diagnostics are excluded.") : "Oldest first. Available record timestamps and appointment times; a complete status-change history is not supplied."}>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Loading case activity</p> : events.length ? <ol aria-label="Case activity timeline" className="space-y-5 border-l border-border pl-5">
      {events.map((event) => <li key={event.id} className="relative text-sm"><span aria-hidden="true" className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-primary" /><h3 className="font-semibold">{event.label}</h3><time dateTime={event.at} className="mt-1 block text-xs text-primary">{requestDate(event.at)}</time><p className="mt-1 text-xs leading-6 text-muted-foreground">{event.context}</p></li>)}
    </ol> : <p className="text-sm text-muted-foreground">No dated activity is available.</p>}
  </ProfessionalPanel>;
}
