import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ClipboardList, ShieldCheck } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";

const workspaces = [
  { href: "/professional/requests", title: "Review requests", description: "Open the requests workspace to review eligible work and its current status.", icon: ClipboardList },
  { href: "/professional/cases", title: "Manage cases", description: "Open your cases workspace for cases assigned to your professional account.", icon: BriefcaseBusiness },
];

export default function ProfessionalOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader label="Professional Side" title="Your workspace" description="A dedicated space for professional work, separate from your personal Echo experience." />
      <EchoCard title="Welcome to your professional workspace" description="Use the navigation to access professional workflows. Client information and case actions must be authorized by the existing backend policies.">
        <div className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white/70 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">Only information you are authorized to access should appear here. This overview does not invent case counts or client data.</p>
        </div>
      </EchoCard>
      <div className="grid gap-5 lg:grid-cols-2">
        {workspaces.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <EchoCard title={title} description={description} action={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8fc89a]/25 text-foreground"><Icon className="h-5 w-5" /></div>
              <p className="mt-4 text-sm font-semibold text-primary">Open workspace <span aria-hidden="true">→</span></p>
            </EchoCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
