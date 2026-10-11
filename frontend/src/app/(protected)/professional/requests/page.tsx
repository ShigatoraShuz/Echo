import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";

export default function ProfessionalRequestsPage() {
  return (
    <div className="space-y-6">
      <Link href="/professional" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-4 w-4" /> Professional overview</Link>
      <PageHeader label="Professional Side" title="Requests" description="Review requests made available to your professional account." />
      <EchoCard title="Requests are not connected yet" description="This screen is ready for the authorized requests API integration. No sample client records are shown.">
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-black/15 bg-white/60 p-5">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="font-semibold">No live request data loaded</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Connect this view to the existing professional requests endpoint before enabling review, claim, or assignment actions. Backend authorization remains the source of truth.</p></div>
        </div>
      </EchoCard>
    </div>
  );
}
