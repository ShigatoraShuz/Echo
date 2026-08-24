"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck2,
  ExternalLink,
  Filter,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { PrivacyNotice } from "@/shared/components/echo";
import { AppShell } from "@/shared/components/layout/echo-shells";
import {
  experienceApi,
  type SupportResource,
} from "@/services/experience/experience-api";
import { normalizeError } from "@/shared/errors/normalize-error";

export default function FindHelpPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setResources(await experienceApi.getSupportResources({ query: query.trim(), type }));
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader
        label="Support directory"
        title="Find help"
        description="Search verified support resources. ECHO is not an emergency service or a substitute for professional care."
      />

      <div className="mb-8">
      <EchoCard
        title="Search verified support"
        description="Results come from ECHO's reviewed support-resource directory."
      >
        <form
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="echo-input pl-10"
              placeholder="Search organizations or support type"
              aria-label="Search support resources"
            />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="echo-input appearance-none pl-10"
              aria-label="Filter support type"
            >
              <option value="all">All verified support</option>
              <option value="crisis_hotline">Crisis hotlines</option>
              <option value="clinic">Clinics</option>
              <option value="counselling">Counselling</option>
            </select>
          </label>
          <button type="submit" className="echo-button-primary justify-center rounded-full px-6">
            Search
          </button>
        </form>
      </EchoCard>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_350px]">
        <section aria-live="polite">
          {isLoading ? (
            <div className="rounded-[1.5rem] border border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              Loading verified resources…
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="rounded-[1.5rem] border border-danger/25 bg-crisis-soft p-6 text-sm text-foreground">
              {error}
            </div>
          ) : null}
          {!isLoading && !error && resources.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border/70 bg-card p-10 text-center">
              <p className="font-semibold text-foreground">No verified matches found.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a broader search or view all support types.</p>
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-[1.8rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(145deg,rgba(255,253,247,0.98),rgba(226,237,220,0.86))] p-6 shadow-[0_18px_46px_rgba(30,53,34,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--landing-sage-soft)] text-primary">
                    <Phone className="h-5 w-5" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                </div>
                <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                  {resource.organizationName}
                </p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-foreground [font-family:var(--font-echo-display)]">
                  {resource.name}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{resource.description}</p>
                {resource.availability ? (
                  <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary">
                    <CalendarCheck2 className="h-4 w-4" />
                    {resource.availability}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {resource.phoneNumber ? (
                    <a
                      href={`tel:${resource.phoneNumber.replace(/[^\d+]/g, "")}`}
                      className="echo-button-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {resource.phoneNumber}
                    </a>
                  ) : null}
                  {resource.websiteUrl ? (
                    <a
                      href={resource.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="echo-button-secondary"
                    >
                      Website <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <EchoCard title="Before you reach out" description="Keep it simple.">
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              <li>• Move somewhere safer if you can.</li>
              <li>• Share only what you are ready to say.</li>
              <li>• In immediate danger, call emergency services.</li>
            </ul>
          </EchoCard>
          <PrivacyNotice />
        </aside>
      </div>
    </AppShell>
  );
}
