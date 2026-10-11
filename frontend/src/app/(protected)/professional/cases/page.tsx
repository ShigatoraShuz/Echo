import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";

export default function ProfessionalCasesPage() {
  return (
    <div className="space-y-6">
      <Link href="/professional" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-4 w-4" /> Professional overview</Link>
      <PageHeader label="Professional Side" title="My cases" description="Access cases assigned to you and shared with your professional account." />
      <EchoCard title="Cases are not connected yet" description="This screen is ready for the authorized cases API integration. No sample client records are shown.">
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-black/15 bg-white/60 p-5">
          <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="font-semibold">No live case data loaded</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Connect this view to the existing professional cases endpoint before showing client details or enabling case actions. Assignment, organization, role, and consent checks must remain enforced by the backend.</p></div>
        </div>
      </EchoCard>
    </div>
  );
}
