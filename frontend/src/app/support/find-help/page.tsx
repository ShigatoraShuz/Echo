import { Filter, Search } from "lucide-react";
import { EchoCard, PageHeader, ProviderCard, PrivacyNotice } from "@/shared/components/legacy";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { clinics, hotlines, providers } from "@/lib/mock-data";

export default function FindHelpPage() {
  return (
    <AppShell>
      <PageHeader
        label="Support"
        title="Find help"
        description="Search providers, hotline options, and local clinics. ECHO is not a diagnostic tool or emergency service."
      />

      <EchoCard title="Search support" description="Filters are ready for a future provider directory API.">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <input className="echo-input pl-10" placeholder="Search therapists, clinics, or support type" />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <select className="echo-input appearance-none pl-10">
              <option>All support</option>
              <option>Therapists</option>
              <option>Clinics</option>
              <option>Hotlines</option>
            </select>
          </label>
          <select className="echo-input">
            <option>Nearest first</option>
            <option>Telehealth available</option>
            <option>Open this week</option>
          </select>
        </div>
      </EchoCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {providers.map((provider) => (
              <ProviderCard key={provider.name} provider={provider} />
            ))}
          </div>

          <EchoCard title="Local clinics" description="Sample clinic list for future location-aware support search.">
            <div className="grid gap-3">
              {clinics.map((clinic) => (
                <div key={clinic.name} className="rounded-2xl border border-border/70 bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">{clinic.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{clinic.location}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{clinic.hours}</p>
                </div>
              ))}
            </div>
          </EchoCard>
        </section>

        <aside className="space-y-6">
          <EchoCard title="Hotlines" description="Use crisis resources immediately if there is danger.">
            <div className="space-y-3">
              {hotlines.map((hotline) => (
                <div key={hotline.name} className="rounded-2xl border border-border/70 bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">{hotline.name}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{hotline.action}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{hotline.description}</p>
                </div>
              ))}
            </div>
          </EchoCard>
          <PrivacyNotice />
        </aside>
      </div>
    </AppShell>
  );
}
