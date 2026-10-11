import Link from "next/link";
import { ArrowLeft, Settings2, ShieldCheck } from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";

export default function ProfessionalSettingsPage() {
  return (
    <div className="space-y-6">
      <Link href="/professional" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-4 w-4" /> Professional overview</Link>
      <PageHeader label="Professional Side" title="Settings" description="Professional account preferences and access status." />
      <EchoCard title="Professional settings integration pending" description="This route is reserved for professional-specific profile and access settings supported by the existing service.">
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-black/15 bg-white/60 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><p className="font-semibold">No settings changed</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Profile edits, credentials, and access controls will be enabled only after their existing API contracts are wired and validated. User Side settings remain available separately.</p><Link href="/settings/profile" className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">Open User Side settings</Link></div>
        </div>
      </EchoCard>
    </div>
  );
}
