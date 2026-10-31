import type { CaseDetail } from "@/services/professionals/professional-api";
import { requestDate } from "../professional-request.model";
import { ProfessionalPanel, ProfessionalRequestStatus } from "./professional-ui";

export function ProfessionalCaseOverview({ detail, preview = false }: { detail: CaseDetail; preview?: boolean }) {
  return <ProfessionalPanel title="Case overview" description={preview ? "Fictional organization and assignment. No case service is connected." : "Organization and assignment returned by the authorized case service."}>
    <dl className="grid gap-5 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-2"><ProfessionalRequestStatus status={detail.request.status} /></dd></div>
      <div><dt className="text-xs text-muted-foreground">Assigned professional ID</dt><dd className="mt-2 break-all">{detail.request.assignedTo || "Unavailable"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Organization ID</dt><dd className="mt-2 break-all">{detail.request.organizationId || "Unavailable"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-2">{requestDate(detail.request.createdAt)}</dd></div>
    </dl>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">{preview ? "Fictional record IDs only. No professional membership or verified credentials are provided." : "Names are not supplied by this case endpoint. Access and permitted actions are checked by the server."}</p>
  </ProfessionalPanel>;
}
