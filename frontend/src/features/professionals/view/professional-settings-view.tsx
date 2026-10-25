"use client";

import { NotificationSoundControls } from "@/shared/components/navigation/notification-sound-controls";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, Check, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { NotificationSettings, ProfileSettings } from "@/features/settings/model/settings.model";
import { settingsService } from "@/services/settings/settings.service";
import { getAuthService } from "@/services/authentication/auth-service.factory";
import { useEchoTheme } from "@/shared/theme/theme-provider";
import type { EchoThemeMode, EchoThemeVariant } from "@/shared/theme/theme";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalPanel } from "../components/professional-ui";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { useProfessionalWorkspace } from "../hooks/use-professional-workspace";
import { reportProfessionalAccessLoss } from "../professional-access-feedback";

const sections = [
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Privacy & security", icon: ShieldCheck },
  { id: "account", label: "Account", icon: LogOut },
] as const;
const roleLabel = (role: string) => role.replace(/_/g, " ");

export function ProfessionalSettingsView() {
  const params = useSearchParams();
  return <SettingsWorkspace key={params.toString()} />;
}

function SettingsWorkspace() {
  const workspace = useProfessionalWorkspace("/professional/settings", "none");
  const { memberships, organizationId, error, activeMembership } = workspace;
  return <ProfessionalShell memberships={memberships ?? undefined} organizationId={organizationId} onOrganizationChange={workspace.switchOrganization}>
    <ProfessionalHeading title="Your workspace, your way" label="Settings" description="Personal preferences. Professional identity. Clear boundaries." />
    {error ? <ProfessionalAccessError failure={error} destination={workspace.destination} onRetry={workspace.retry} /> : !organizationId || !memberships ? <ProfessionalSkeleton title="Checking settings access" variant="content" /> : <AccountSettings key={organizationId + workspace.userId} userId={workspace.userId} membership={activeMembership!} />}
  </ProfessionalShell>;
}

type AccountFields = { profile: ProfileSettings; notifications: NotificationSettings };
function AccountSettings({ userId, membership }: { userId: string; membership: NonNullable<ReturnType<typeof useProfessionalWorkspace>["activeMembership"]> }) {
  const router = useRouter();
  const theme = useEchoTheme();
  const [section, setSection] = useState<typeof sections[number]["id"]>("profile");
  const [fields, setFields] = useState<AccountFields | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const version = useRef(0);
  const mutation = useRef(false);
  const pending = useRef<Promise<AccountFields> | null>(null);
  const load = useCallback(async () => {
    const current = ++version.current;
    setFields(null); setError(""); setSaved("");
    try {
      // Reuse the authorized account endpoint. Retain only the fields this view
      // needs, never its contacts, exports, deletion state or clinical records.
      const result = await (pending.current ??= settingsService.get().then(({ profile, notifications }) => ({ profile, notifications })).finally(() => { pending.current = null; }));
      if (current !== version.current) return;
      setFields(result); setName(result.profile.displayName); setTimezone(result.profile.timezone);
    } catch (reason) { if (current === version.current) setError(reportProfessionalAccessLoss(reason).message); }
  }, []);
  useEffect(() => { void load(); return () => { version.current += 1; }; }, [load]);
  useEffect(() => {
    const clear = () => { version.current += 1; setFields(null); setName(""); setTimezone(""); setError("Sign in again to view account settings."); };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    return () => window.removeEventListener("echo:sensitive-state-cleared", clear);
  }, []);
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!fields || mutation.current) return;
    if (!name.trim() || name.trim().length > 80) { setError("Enter a display name of 1–80 characters."); return; }
    try { new Intl.DateTimeFormat("en", { timeZone: timezone.trim() }).format(); } catch { setError("Enter a valid time zone, such as Asia/Manila."); return; }
    await save(async () => {
      const profile = await settingsService.updateProfile({ displayName: name.trim(), timezone: timezone.trim(), themeMode: fields.profile.themeMode, themeVariant: fields.profile.themeVariant });
      return { ...fields, profile };
    }, "Profile saved.");
  }
  async function save(work: () => Promise<AccountFields>, message: string, after?: () => void) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(""); setSaved("");
    const current = version.current;
    try { const result = await work(); if (current === version.current) { setFields(result); setSaved(message); after?.(); } }
    catch (reason) { if (current === version.current) { setFields(null); setError(reportProfessionalAccessLoss(reason).message); } }
    finally { if (current === version.current) { mutation.current = false; setBusy(false); } }
  }
  async function signOut() {
    if (mutation.current) return;
    mutation.current = true; setSigningOut(true); setFields(null); setName(""); setTimezone(""); version.current += 1;
    try { const result = await getAuthService().logout(); if (!result.success) throw new Error("Logout unavailable"); router.replace("/professional/login"); router.refresh(); }
    catch { setError("Could not sign out. Please try again."); mutation.current = false; setSigningOut(false); }
  }
  return <div className="pro-settings-grid">
    <nav className="pro-settings-nav" aria-label="Settings sections">{sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" className="echo-focus-ring" aria-current={section === id ? "page" : undefined} onClick={() => { setSection(id); setSaved(""); }}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
    <div className="pro-settings-content">
      {process.env.NODE_ENV === "development" && membership.role === "org_admin" ? <section aria-label="Clinician demonstration" className="mb-5 rounded-2xl border border-primary/20 bg-secondary/50 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-primary">Local development only</p><h2 className="mt-2 text-2xl [font-family:var(--font-echo-display)]">See the care workspace</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Explore fictional clinician screens. Your administrator role and clinical access stay unchanged.</p><Link prefetch={false} href={"/dev/professional-preview?returnOrganization=" + encodeURIComponent(membership.organizationId)} className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Preview as Professional</Link></section> : null}
      {saved ? <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-primary"><Check size={18} />{saved}</p> : null}
      {error ? <div role="alert" className="mb-4 rounded-2xl border border-border bg-card p-5"><p className="text-sm">{error}</p>{!fields ? <EchoButton variant="outline" size="small" className="mt-3" onClick={() => void load()}>Reload account settings</EchoButton> : null}</div> : null}
      {signingOut ? <p role="status">Signing out of professional workspace…</p> : !fields && !error ? <ProfessionalSkeleton title="Loading account settings" variant="content" /> : fields ? <>
        {section === "profile" ? <ProfessionalPanel title="My profile" icon={UserRound} description="Personal account details · shared across ECHO.">
          <div className="mb-5 flex items-center gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-xl font-semibold text-primary" aria-hidden="true">{fields.profile.displayName.trim().slice(0,1).toUpperCase() || <UserRound />}</span><div className="min-w-0"><h3 className="break-words text-lg font-semibold">{fields.profile.displayName || "Your account"}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{roleLabel(membership.role)} · {membership.organization?.name ?? "Active organization"}</p></div></div>
          <form onSubmit={event => void saveProfile(event)} className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Display name<input className="echo-input mt-2 min-h-11 w-full" autoComplete="name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} /></label><label className="text-xs font-semibold">Time zone<input aria-label="Time zone" className="echo-input mt-2 min-h-11 w-full" maxLength={100} required value={timezone} onChange={event => setTimezone(event.target.value)} aria-describedby="professional-timezone-help" /><span id="professional-timezone-help" className="mt-2 block text-xs font-normal text-muted-foreground">For example, Asia/Manila.</span></label><div className="flex flex-wrap items-center gap-3 sm:col-span-2"><EchoButton type="submit" size="small" disabled={busy || name === fields.profile.displayName && timezone === fields.profile.timezone}>{busy ? "Saving…" : "Save profile"}</EchoButton><p className="text-xs text-muted-foreground">Your verified professional identity is managed separately.</p></div></form>
        </ProfessionalPanel> : null}
        {section === "organization" ? <ProfessionalPanel title="Professional identity" icon={Building2} description="Verified membership · managed by your organization."><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{[["Organization", membership.organization?.name ?? "Name unavailable"],["Professional display name",membership.displayName],["Role",roleLabel(membership.role)],["Membership status",membership.status],["Verified credential",membership.credentialLabel ?? "No credential label recorded"],["Credential expiry",membership.credentialExpiresAt ? new Date(membership.credentialExpiresAt).toLocaleDateString() : "No expiry recorded"]].map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm font-semibold capitalize">{value}</dd></div>)}</dl><p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">Contact your organization administrator to request changes to your role, approval or verified credentials. Switching organizations shows that membership’s details.</p></ProfessionalPanel> : null}
        {section === "notifications" ? <ProfessionalPanel title="Notification preferences" icon={Bell} description="Account-wide delivery preference."><NotificationSoundControls userId={userId} /><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">In-app notifications</h3><p>Receive supported updates in ECHO. This preference also applies to your personal account.</p></div><label className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="size-5 accent-primary" disabled={busy} checked={fields.notifications.inAppEnabled} onChange={event => { const inAppEnabled = event.target.checked; void save(async () => ({ ...fields, notifications: await settingsService.updateNotifications({ ...fields.notifications, inAppEnabled }) }), "Notification preference saved."); }} />Enabled</label></div><p className="mt-4 text-xs leading-6 text-muted-foreground">Professional notifications currently support in-app updates for assigned cases, appointments, referrals and follow-ups. General broadcasts, professional email delivery and push delivery are not available. Administrative roles do not receive clinical updates.</p></ProfessionalPanel> : null}
        {section === "appearance" ? <ProfessionalPanel title="Appearance & accessibility" icon={Palette} description="Existing ECHO themes · no changes to the shared palette."><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">Color mode</h3><p>Saved to your account and applied across ECHO.</p></div><label className="text-xs"><span className="sr-only">Color mode</span><select aria-label="Color mode" className="echo-input min-h-11" disabled={busy} value={fields.profile.themeMode} onChange={event => { const themeMode = event.target.value as EchoThemeMode; const profile = { displayName: fields.profile.displayName, timezone: fields.profile.timezone, themeVariant: fields.profile.themeVariant, themeMode }; void save(async () => ({ ...fields, profile: await settingsService.updateProfile(profile) }), "Appearance saved.", () => theme.setMode(themeMode)); }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">Theme</h3><p>Choose from the existing ECHO themes.</p></div><label className="text-xs"><span className="sr-only">Theme</span><select aria-label="Theme" className="echo-input min-h-11" disabled={busy} value={fields.profile.themeVariant} onChange={event => { const themeVariant = event.target.value as EchoThemeVariant; const profile = { displayName: fields.profile.displayName, timezone: fields.profile.timezone, themeMode: fields.profile.themeMode, themeVariant }; void save(async () => ({ ...fields, profile: await settingsService.updateProfile(profile) }), "Appearance saved.", () => theme.setVariant(themeVariant)); }}><option value="echo-calm">Calm</option><option value="echo-night">Night</option><option value="echo-soft">Soft</option><option value="echo-focus">Focus</option></select></label></div><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">Motion</h3><p>System respects your device’s reduced-motion preference. This choice is saved on this device.</p></div><label className="text-xs"><span className="sr-only">Motion preference</span><select aria-label="Motion preference" className="echo-input min-h-11" value={theme.motion} onChange={event => theme.setMotion(event.target.value as "system" | "full")}><option value="system">Follow system</option><option value="full">Full motion</option></select></label></div></ProfessionalPanel> : null}
        {section === "security" ? <ProfessionalPanel title="Privacy & security" icon={ShieldCheck} description="Secure account controls, using ECHO’s existing settings."><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">Password, sessions & security history</h3><p>Manage your password and sign out other devices. Professional MFA and clinical authorization still apply.</p></div><Link href="/settings/security" className="echo-focus-ring inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary underline">Open security settings</Link></div><div className="pro-setting-row"><div><h3 className="text-sm font-semibold">Personal privacy preferences</h3><p>Review account-wide privacy choices. These controls do not grant clinical access or change a person’s sharing consent.</p></div><Link href="/settings/privacy" className="echo-focus-ring inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary underline">Open privacy settings</Link></div></ProfessionalPanel> : null}
        {section === "account" ? <ProfessionalPanel title="Your account" icon={UserRound}><p className="text-xs text-muted-foreground">Authenticated account ID</p><p className="mt-2 break-all font-mono text-xs">{userId}</p><div className="pro-setting-row mt-5"><div><h3 className="text-sm font-semibold">Sign out</h3><p>End this session and clear sensitive workspace data.</p></div><EchoButton variant="outline" size="small" onClick={() => void signOut()} disabled={busy}><LogOut size={16} />Sign out of ECHO</EchoButton></div></ProfessionalPanel> : null}
      </> : null}
    </div>
  </div>;
}
