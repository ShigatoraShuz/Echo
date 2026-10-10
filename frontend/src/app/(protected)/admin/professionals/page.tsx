"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, History, ShieldCheck, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import {
  professionalApi,
  type AdminMembership,
  type Organization,
  type ProfessionalAuditEvent,
} from "@/services/professionals/professional-api";

type Role = "counselor" | "psychologist" | "social_worker" | "coordinator" | "org_admin";

export default function AdminProfessionalsPage() {
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<AdminMembership[] | null>(null);
  const [events, setEvents] = useState<ProfessionalAuditEvent[] | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [serviceHours, setServiceHours] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("counselor");
  const [credentialLabel, setCredentialLabel] = useState("");
  const [credentialExpiresAt, setCredentialExpiresAt] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [organizationReviewed, setOrganizationReviewed] = useState(false);

  const loadOrganizations = useCallback(async () => {
    try {
      const result = await professionalApi.adminOrganizations();
      setOrganizations(result.organizations);
      setForbidden(false);
      setSelectedId((current) =>
        result.organizations.some((item) => item.id === current) ? current : (result.organizations[0]?.id ?? ""),
      );
      setError("");
    } catch (reason) {
      setOrganizations([]);
      const failure = normalizeError(reason);
      setForbidden(failure.statusCode === 401 || failure.statusCode === 403);
      setError(failure.userMessage);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);
  useEffect(() => {
    if (!selectedId) {
      setMembers([]);
      setEvents([]);
      return;
    }
    let active = true;
    setMembers(null);
    setEvents(null);
    void Promise.all([professionalApi.adminMembers(selectedId), professionalApi.adminAudit(selectedId)])
      .then(([memberResult, auditResult]) => {
        if (active) {
          setMembers(memberResult.memberships);
          setEvents(auditResult.events);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setMembers([]);
          setEvents([]);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId, busy]);

  async function run(action: string, task: () => Promise<unknown>) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await task();
      await loadOrganizations();
      setNotice("Saved. Review the status shown below.");
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusy("");
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("create-organization", async () => {
      const result = await professionalApi.createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        serviceHours: serviceHours.trim(),
      });
      setName("");
      setSlug("");
      setDescription("");
      setServiceHours("");
      setSelectedId(result.organization.id);
    });
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewed || !selectedId) return;
    await run("add-member", async () => {
      await professionalApi.approveMember({
        organizationId: selectedId,
        userId: userId.trim(),
        role,
        displayName: displayName.trim(),
        credentialLabel: credentialLabel.trim() || null,
        credentialExpiresAt: credentialExpiresAt || null,
        credentialChecked: true,
      });
      setUserId("");
      setDisplayName("");
      setCredentialLabel("");
      setCredentialExpiresAt("");
      setReviewed(false);
    });
  }

  const selected = organizations?.find((item) => item.id === selectedId);
  const practitioner = role === "counselor" || role === "psychologist" || role === "social_worker";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-primary/15 bg-[linear-gradient(115deg,rgba(251,247,238,0.97),rgba(220,232,214,0.78))] p-6 shadow-subtle sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">ECHO · Admin workspace</p>
          <h1 className="mt-2 text-3xl [font-family:var(--font-echo-display)] sm:text-4xl">Professional access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review each organization and staff credential before granting case access. Identity verification alone does
            not grant professional access.
          </p>
          <Link href="/admin/verifications" className="mt-4 inline-block text-sm font-semibold text-primary underline">
            Identity reviews
          </Link>
        </header>
        {error ? (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 p-4 text-sm">
            {error}{" "}
            <Link href="/settings/security" className="font-semibold underline">
              Check sign-in security
            </Link>
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-xl bg-secondary p-4 text-sm text-primary">
            {notice}
          </p>
        ) : null}
        {!forbidden ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-border bg-card p-5 shadow-subtle sm:p-7">
                <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                  <Building2 size={20} className="text-primary" />
                  Organizations
                </h2>
                {organizations === null ? (
                  <div role="status" aria-busy="true" className="mt-4 space-y-3">
                    <span className="sr-only">Loading organizations</span>
                    {[0, 1, 2].map((item) => (
                      <EchoSkeleton key={item} variant="rectangular" className="h-20 w-full" />
                    ))}
                  </div>
                ) : organizations.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No partner organizations have been added yet.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {organizations.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id);
                          setOrganizationReviewed(false);
                        }}
                        aria-pressed={selectedId === item.id}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === item.id ? "border-primary bg-secondary/60" : "border-border hover:bg-secondary/30"}`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">{item.name}</strong>
                          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold capitalize text-primary">
                            {item.status}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.slug} · {item.serviceHours || "Hours not specified"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selected ? (
                  <div className="mt-5 rounded-2xl bg-secondary/50 p-4">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {selected.description || "No service description entered."}
                    </p>
                    {selected.status !== "active" ? (
                      <label className="mt-3 flex items-start gap-2 text-xs leading-5">
                        <input
                          type="checkbox"
                          checked={organizationReviewed}
                          onChange={(event) => setOrganizationReviewed(event.target.checked)}
                          className="mt-1 accent-primary"
                        />
                        I reviewed this organization&apos;s identity, service scope, and contact process.
                      </label>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Suspending the organization also suspends all its staff. Each staff member needs review again
                        after reactivation.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.status !== "active" ? (
                        <EchoButton
                          size="small"
                          isLoading={busy === "approve-organization"}
                          disabled={Boolean(busy) || !organizationReviewed}
                          onClick={() =>
                            void run("approve-organization", async () => {
                              await professionalApi.approveOrganization(selected.id);
                              setOrganizationReviewed(false);
                            })
                          }
                        >
                          {selected.status === "suspended" ? "Reactivate after review" : "Approve organization"}
                        </EchoButton>
                      ) : (
                        <EchoButton
                          size="small"
                          variant="outline"
                          disabled={Boolean(busy)}
                          isLoading={busy === "suspend-organization"}
                          onClick={() =>
                            void run("suspend-organization", () => professionalApi.suspendOrganization(selected.id))
                          }
                        >
                          Suspend access
                        </EchoButton>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
              {selected?.status === "active" ? (
                <section className="rounded-3xl border border-border bg-card p-5 shadow-subtle sm:p-7">
                  <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                    <UserRoundCheck size={20} className="text-primary" />
                    Staff access
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Users must already have an ECHO account. Enter their account UUID after checking their identity and
                    role.
                  </p>
                  {members === null ? (
                    <div role="status" aria-busy="true" className="mt-4 space-y-2">
                      <span className="sr-only">Loading staff</span>
                      <EchoSkeleton variant="rectangular" className="h-16 w-full" />
                      <EchoSkeleton variant="rectangular" className="h-16 w-full" />
                    </div>
                  ) : members.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No staff approved yet.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
                        >
                          <div>
                            <strong className="text-sm">{member.displayName}</strong>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {member.role.replaceAll("_", " ")} · {member.status} ·{" "}
                              {member.credentialExpiresAt ?? "No expiry"}
                            </p>
                          </div>
                          {member.status === "active" ? (
                            <EchoButton
                              size="small"
                              variant="outline"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                void run(`suspend-${member.id}`, () => professionalApi.suspendMember(member.id))
                              }
                            >
                              Suspend
                            </EchoButton>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
              {selected ? (
                <section className="rounded-3xl border border-border bg-card p-5 shadow-subtle sm:p-7">
                  <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                    <History size={20} className="text-primary" />
                    Recent activity
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Latest 100 access and case actions for this organization.
                  </p>
                  {events === null ? (
                    <div role="status" aria-busy="true" className="mt-4 space-y-2">
                      <span className="sr-only">Loading activity</span>
                      <EchoSkeleton variant="rectangular" className="h-14 w-full" />
                      <EchoSkeleton variant="rectangular" className="h-14 w-full" />
                    </div>
                  ) : events.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No activity recorded yet.</p>
                  ) : (
                    <ol className="mt-4 divide-y divide-border/70">
                      {events.map((event) => (
                        <li key={event.id} className="py-3 text-xs">
                          <strong className="block text-sm font-semibold text-foreground">
                            {event.action.replaceAll(".", " ").replaceAll("_", " ")}
                          </strong>
                          <span className="mt-1 block text-muted-foreground">
                            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                              new Date(event.createdAt),
                            )}{" "}
                            · Actor {event.actorUserId.slice(0, 8)}
                            {event.subjectUserId ? ` · Staff ${event.subjectUserId.slice(0, 8)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ) : null}
            </div>
            <aside className="space-y-5">
              <form
                onSubmit={(event) => void createOrganization(event)}
                className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-subtle"
              >
                <h2 className="text-xl [font-family:var(--font-echo-display)]">Add an organization</h2>
                <p className="text-xs leading-5 text-muted-foreground">
                  It stays pending until you review and approve it.
                </p>
                <label className="block text-xs font-semibold">
                  Organization name
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    className="echo-input mt-1"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  URL slug
                  <input
                    required
                    maxLength={80}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    className="echo-input mt-1"
                    placeholder="partner-school"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Service description
                  <textarea
                    maxLength={600}
                    rows={3}
                    className="echo-input mt-1"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Service hours
                  <input
                    maxLength={240}
                    className="echo-input mt-1"
                    value={serviceHours}
                    onChange={(event) => setServiceHours(event.target.value)}
                  />
                </label>
                <EchoButton type="submit" disabled={Boolean(busy)} isLoading={busy === "create-organization"}>
                  Add pending organization
                </EchoButton>
              </form>
              {selected?.status === "active" ? (
                <form
                  onSubmit={(event) => void addMember(event)}
                  className="space-y-3 rounded-3xl border border-primary/15 bg-secondary/50 p-5"
                >
                  <h2 className="flex items-center gap-2 text-xl [font-family:var(--font-echo-display)]">
                    <ShieldCheck size={18} className="text-primary" />
                    Approve staff
                  </h2>
                  <label className="block text-xs font-semibold">
                    ECHO user UUID
                    <input
                      required
                      type="text"
                      pattern="[0-9a-fA-F-]{36}"
                      className="echo-input mt-1"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    Display name
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      className="echo-input mt-1"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    Role
                    <select
                      className="echo-input mt-1"
                      value={role}
                      onChange={(event) => setRole(event.target.value as Role)}
                    >
                      <option value="counselor">Counselor</option>
                      <option value="psychologist">Psychologist</option>
                      <option value="social_worker">Social worker</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="org_admin">Organization admin</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold">
                    Credential or appointment label
                    <input
                      required={practitioner}
                      maxLength={160}
                      className="echo-input mt-1"
                      value={credentialLabel}
                      onChange={(event) => setCredentialLabel(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    Credential expiry
                    <input
                      required={practitioner}
                      type="date"
                      className="echo-input mt-1"
                      value={credentialExpiresAt}
                      onChange={(event) => setCredentialExpiresAt(event.target.value)}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs leading-5">
                    <input
                      type="checkbox"
                      required
                      checked={reviewed}
                      onChange={(event) => setReviewed(event.target.checked)}
                      className="mt-1 accent-primary"
                    />
                    I checked the user&apos;s identity, organization affiliation, role, and current credential where
                    required.
                  </label>
                  <EchoButton type="submit" disabled={!reviewed || Boolean(busy)} isLoading={busy === "add-member"}>
                    Approve access
                  </EchoButton>
                </form>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
