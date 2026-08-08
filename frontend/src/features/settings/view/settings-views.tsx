"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  KeyRound,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { cn } from "@/lib/utils";
import { useEchoTheme } from "@/shared/theme";
import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "../components";
import { useSettingsViewModel } from "../view-model/use-settings-view-model";
import type {
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
  TrustedContact,
  TrustedContactInput,
} from "../model/settings.model";
import { settingsService } from "../services/settings.service";

const timezoneOptions = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

const emptyContact: TrustedContactInput = {
  contactName: "",
  contactEmail: null,
  contactPhone: null,
  relationship: "",
  isPrimary: false,
  permissionAcknowledged: false,
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function StateMessage({
  error,
  notice,
  onRetry,
}: {
  error: string | null;
  notice: string | null;
  onRetry?: () => void;
}) {
  if (!error && !notice) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
        error
          ? "border-danger/25 bg-danger/8 text-danger"
          : "border-primary/20 bg-secondary/70 text-primary",
      )}
    >
      <span className="flex items-center gap-2">
        {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
        {error ?? notice}
      </span>
      {error && onRetry ? (
        <button type="button" onClick={onRetry} className="text-xs font-semibold underline underline-offset-4">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-72 place-items-center rounded-[1.6rem] border border-border/65 bg-card/85">
      <div className="text-center text-sm text-muted-foreground">
        <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
        Loading your private settings…
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  busy = false,
  disabled = false,
  className,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-subtle outline-none transition-[transform,background-color,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-card focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  className,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-[transform,background-color] duration-200 hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-background/72 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-70",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function SettingsFailure({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <SettingsSection title="We could not load Settings" description="Your saved data was not changed.">
      <StateMessage error={error} notice={null} onRetry={onRetry} />
      <Link href="/login" className="text-sm font-semibold text-primary underline underline-offset-4">
        Sign in again
      </Link>
    </SettingsSection>
  );
}

export function ProfileSettingsView() {
  const { settings, loading, saving, error, notice, refresh, run } = useSettingsViewModel();
  const theme = useEchoTheme();
  const [form, setForm] = useState<ProfileSettings | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm(settings.profile);
    theme.setTheme({
      variant: settings.profile.themeVariant,
      mode: settings.profile.themeMode,
    });
    // setTheme is stable; the profile values are the intended synchronization boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.profile.themeMode, settings?.profile.themeVariant, settings?.profile.displayName, settings?.profile.timezone]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    await run(
      () =>
        settingsService.updateProfile({
          ...form,
          themeVariant: theme.variant,
          themeMode: theme.mode,
        }),
      "Profile and appearance saved.",
    );
  };

  return (
    <SettingsShell>
      <SettingsHeader
        id="profile-overview"
        title="Profile"
        description="Keep your greeting, timezone, and ECHO appearance consistent on every signed-in device."
        showThemeControls
      />
      <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />
      {loading ? (
        <LoadingState />
      ) : !settings || !form ? (
        <SettingsFailure error={error ?? "Settings are unavailable."} onRetry={() => void refresh()} />
      ) : (
        <form onSubmit={submit}>
          <SettingsSection
            id="personal-details"
            title="Personal details"
            description="These details shape dashboard greetings, reminder timing, and private exports."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Display name">
                <span className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <input
                    className="echo-input pl-10"
                    value={form.displayName}
                    maxLength={80}
                    required
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                    autoComplete="name"
                  />
                </span>
              </Field>
              <Field label="Timezone" hint="Used for reminders and weekly reflection summaries.">
                <select
                  className="echo-input"
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                >
                  {timezoneOptions.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex justify-end border-t border-border/65 pt-4">
              <PrimaryButton type="submit" busy={saving}>
                <Save className="h-4 w-4" />
                Save profile
              </PrimaryButton>
            </div>
          </SettingsSection>
        </form>
      )}
    </SettingsShell>
  );
}

export function PrivacySettingsView() {
  const { settings, loading, saving, error, notice, refresh, run } = useSettingsViewModel();
  const [form, setForm] = useState<Omit<PrivacySettings, "journalPrivate"> | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      facialAnalysisEnabled: settings.privacy.facialAnalysisEnabled,
      crisisSupportVisible: settings.privacy.crisisSupportVisible,
      lockScreenPrivate: settings.privacy.lockScreenPrivate,
    });
  }, [settings]);

  return (
    <SettingsShell>
      <SettingsHeader
        title="Privacy"
        description="Choose what appears on your device and which optional wellbeing features may be used."
      />
      <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />
      {loading ? (
        <LoadingState />
      ) : !settings || !form ? (
        <SettingsFailure error={error ?? "Privacy controls are unavailable."} onRetry={() => void refresh()} />
      ) : (
        <SettingsSection
          title="Private-by-design controls"
          description="Journal content remains private. These controls only change optional experiences."
        >
          <Toggle
            checked
            disabled
            onChange={() => undefined}
            label="Private journal storage"
            description="Your entries are not shared automatically. Only you can request an export."
          />
          <Toggle
            checked={form.facialAnalysisEnabled}
            onChange={(value) => setForm({ ...form, facialAnalysisEnabled: value })}
            label="Facial analysis"
            description="Allow camera-based emotional check-ins only when you start one. Off is the privacy-first default."
          />
          <Toggle
            checked={form.crisisSupportVisible}
            onChange={(value) => setForm({ ...form, crisisSupportVisible: value })}
            label="Keep crisis resources visible"
            description="Show safety and local support resources in high-risk states. This does not contact anyone automatically."
          />
          <Toggle
            checked={form.lockScreenPrivate}
            onChange={(value) => setForm({ ...form, lockScreenPrivate: value })}
            label="Private lock-screen previews"
            description="Use neutral wording so journal details do not appear in notification previews."
          />
          <div className="flex justify-end border-t border-border/65 pt-4">
            <PrimaryButton
              busy={saving}
              onClick={() =>
                void run(() => settingsService.updatePrivacy(form), "Privacy choices saved.")
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Save privacy
            </PrimaryButton>
          </div>
        </SettingsSection>
      )}
    </SettingsShell>
  );
}

export function NotificationSettingsView() {
  const { settings, loading, saving, error, notice, refresh, run } = useSettingsViewModel();
  const [form, setForm] = useState<NotificationSettings | null>(null);
  useEffect(() => {
    if (settings) setForm(settings.notifications);
  }, [settings]);

  const remindersEnabled = Boolean(form?.journalRemindersEnabled || form?.wellbeingRemindersEnabled);

  return (
    <SettingsShell>
      <SettingsHeader
        title="Notifications"
        description="Set a gentle rhythm without putting private journal content on your lock screen."
      />
      <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />
      {loading ? (
        <LoadingState />
      ) : !settings || !form ? (
        <SettingsFailure error={error ?? "Notification settings are unavailable."} onRetry={() => void refresh()} />
      ) : (
        <SettingsSection title="Reminder preferences" description="Every reminder can be changed or turned off at any time.">
          <div className="grid gap-3 lg:grid-cols-2">
            <Toggle
              checked={form.inAppEnabled}
              onChange={(value) => setForm({ ...form, inAppEnabled: value })}
              label="In-app notifications"
              description="Updates appear only inside ECHO."
            />
            <Toggle
              checked={form.emailEnabled}
              onChange={(value) => setForm({ ...form, emailEnabled: value })}
              label="Email"
              description="Send account and reflection reminders by email."
            />
            <Toggle
              checked={form.pushEnabled}
              onChange={(value) => setForm({ ...form, pushEnabled: value })}
              label="Push notifications"
              description="Allow neutral reminders on supported devices."
            />
            <Toggle
              checked={form.insightNotificationsEnabled}
              onChange={(value) => setForm({ ...form, insightNotificationsEnabled: value })}
              label="Reflection insights"
              description="Tell you when an optional summary is ready."
            />
            <Toggle
              checked={form.journalRemindersEnabled}
              onChange={(value) =>
                setForm({
                  ...form,
                  journalRemindersEnabled: value,
                  reminderTimezone: value
                    ? form.reminderTimezone ?? settings.profile.timezone
                    : form.reminderTimezone,
                })
              }
              label="Journal check-in"
              description="A quiet prompt to write at your chosen time."
            />
            <Toggle
              checked={form.wellbeingRemindersEnabled}
              onChange={(value) =>
                setForm({
                  ...form,
                  wellbeingRemindersEnabled: value,
                  reminderTimezone: value
                    ? form.reminderTimezone ?? settings.profile.timezone
                    : form.reminderTimezone,
                })
              }
              label="Grounding practice"
              description="A short breathing or grounding invitation."
            />
          </div>
          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/72 p-4 sm:grid-cols-2">
            <Field label="Reminder time">
              <input
                type="time"
                className="echo-input"
                disabled={!remindersEnabled}
                required={remindersEnabled}
                value={form.reminderTime ?? ""}
                onChange={(event) => setForm({ ...form, reminderTime: event.target.value || null })}
                onInput={(event) =>
                  setForm({ ...form, reminderTime: event.currentTarget.value || null })
                }
              />
            </Field>
            <Field label="Reminder timezone">
              <select
                className="echo-input"
                disabled={!remindersEnabled}
                value={form.reminderTimezone ?? settings.profile.timezone}
                onChange={(event) => setForm({ ...form, reminderTimezone: event.target.value })}
                onInput={(event) =>
                  setForm({ ...form, reminderTimezone: event.currentTarget.value })
                }
              >
                {timezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end border-t border-border/65 pt-4">
            <PrimaryButton
              busy={saving}
              disabled={remindersEnabled && (!form.reminderTime || !form.reminderTimezone)}
              onClick={() =>
                void run(
                  () =>
                    settingsService.updateNotifications({
                      ...form,
                      reminderTime: remindersEnabled ? form.reminderTime : null,
                      reminderTimezone: remindersEnabled ? form.reminderTimezone ?? settings.profile.timezone : null,
                    }),
                  "Notification preferences saved.",
                )
              }
            >
              <Bell className="h-4 w-4" />
              Save reminders
            </PrimaryButton>
          </div>
        </SettingsSection>
      )}
    </SettingsShell>
  );
}

function ContactForm({
  value,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: TrustedContactInput;
  saving: boolean;
  onChange: (value: TrustedContactInput) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="grid gap-4 rounded-2xl border border-primary/15 bg-secondary/45 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className="echo-input"
            required
            maxLength={200}
            value={value.contactName}
            onChange={(event) => onChange({ ...value, contactName: event.target.value })}
          />
        </Field>
        <Field label="Relationship">
          <input
            className="echo-input"
            required
            maxLength={100}
            placeholder="Friend, partner, provider…"
            value={value.relationship}
            onChange={(event) => onChange({ ...value, relationship: event.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="echo-input"
            type="email"
            maxLength={320}
            placeholder="name@example.com"
            value={value.contactEmail ?? ""}
            onChange={(event) => onChange({ ...value, contactEmail: event.target.value || null })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="echo-input"
            type="tel"
            maxLength={40}
            placeholder="+63 …"
            value={value.contactPhone ?? ""}
            onChange={(event) => onChange({ ...value, contactPhone: event.target.value || null })}
          />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
          checked={value.isPrimary}
          onChange={(event) => onChange({ ...value, isPrimary: event.target.checked })}
        />
        Make this my primary trusted contact
      </label>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          required
          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
          checked={value.permissionAcknowledged}
          onChange={(event) => onChange({ ...value, permissionAcknowledged: event.target.checked })}
        />
        <span>
          This person agreed to be listed as my trusted contact.
          <span className="mt-1 block text-xs text-muted-foreground">
            ECHO never sends journal entries or contacts them automatically.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton> : null}
        <PrimaryButton
          type="submit"
          busy={saving}
          disabled={!value.contactEmail && !value.contactPhone}
        >
          <Save className="h-4 w-4" />
          Save contact
        </PrimaryButton>
      </div>
    </form>
  );
}

export function TrustedContactsSettingsView() {
  const { settings, loading, saving, error, notice, refresh, run } = useSettingsViewModel();
  const [form, setForm] = useState<TrustedContactInput>(emptyContact);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const edit = (contact: TrustedContact) => {
    setEditingId(contact.id);
    setAdding(true);
    setForm({
      contactName: contact.contactName,
      contactEmail: contact.contactEmail,
      contactPhone: contact.contactPhone,
      relationship: contact.relationship,
      isPrimary: contact.isPrimary,
      permissionAcknowledged: contact.permissionAcknowledged,
    });
  };

  const closeForm = () => {
    setEditingId(null);
    setAdding(false);
    setForm(emptyContact);
  };

  const save = async () => {
    const success = await run(
      () =>
        editingId
          ? settingsService.updateContact(editingId, form)
          : settingsService.createContact(form),
      editingId ? "Trusted contact updated." : "Trusted contact added.",
    );
    if (success) closeForm();
  };

  return (
    <SettingsShell>
      <SettingsHeader
        title="Trusted contacts"
        description="Keep a private support circle ready for the moments when you choose to reach out."
      />
      <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />
      {loading ? (
        <LoadingState />
      ) : !settings ? (
        <SettingsFailure error={error ?? "Trusted contacts are unavailable."} onRetry={() => void refresh()} />
      ) : (
        <SettingsSection
          title="Your support circle"
          description="Contacts are encrypted in transit and owner-scoped in the database. Nothing is shared automatically."
        >
          <div className="flex justify-end">
            <PrimaryButton
              onClick={() => {
                setAdding(true);
                setEditingId(null);
                setForm(emptyContact);
              }}
            >
              <Plus className="h-4 w-4" />
              Add contact
            </PrimaryButton>
          </div>
          {adding ? (
            <ContactForm value={form} saving={saving} onChange={setForm} onSubmit={() => void save()} onCancel={closeForm} />
          ) : null}
          {settings.trustedContacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <UserRound className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-sm font-semibold">No trusted contacts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Add someone only after they agree.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {settings.trustedContacts.map((contact) => (
                <article key={contact.id} className="rounded-2xl border border-border/70 bg-background/72 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{contact.contactName}</h3>
                        {contact.isPrimary ? (
                          <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{contact.relationship}</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => edit(contact)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label={`Edit ${contact.contactName}`}>
                        <Pencil className="h-4 w-4 text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${contact.contactName} from trusted contacts?`)) {
                            void run(() => settingsService.removeContact(contact.id), "Trusted contact removed.");
                          }
                        }}
                        className="grid h-9 w-9 place-items-center rounded-full text-danger hover:bg-danger/10"
                        aria-label={`Remove ${contact.contactName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    {contact.contactEmail ? (
                      <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{contact.contactEmail}</p>
                    ) : null}
                    {contact.contactPhone ? (
                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{contact.contactPhone}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SettingsSection>
      )}
    </SettingsShell>
  );
}

export function SecuritySettingsView() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorVerified, setFactorVerified] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const configured = Boolean(getSupabasePublicConfig());

  useEffect(() => {
    if (!configured) return;
    const client = createBrowserSupabaseClient();
    void client.auth.mfa.listFactors().then(async ({ data }) => {
      const factors = data?.totp ?? [];
      const verifiedFactor = factors.find((factor) => factor.status === "verified");
      const incompleteFactors = factors.filter((factor) => factor.status !== "verified");
      await Promise.all(
        incompleteFactors.map((factor) => client.auth.mfa.unenroll({ factorId: factor.id })),
      );
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setFactorVerified(true);
      }
    });
  }, [configured]);

  const action = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The security action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    await action(async () => {
      const { error: authError } = await createBrowserSupabaseClient().auth.updateUser({ password });
      if (authError) throw authError;
      setPassword("");
      setConfirmPassword("");
    }, "Password updated.");
  };

  const beginMfa = async () => {
    await action(async () => {
      const client = createBrowserSupabaseClient();
      const { data: existingFactors } = await client.auth.mfa.listFactors();
      await Promise.all(
        (existingFactors?.totp ?? [])
          .filter((factor) => factor.status !== "verified")
          .map((factor) => client.auth.mfa.unenroll({ factorId: factor.id })),
      );

      const { data, error: authError } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `ECHO authenticator ${Date.now()}`,
      });
      if (authError) throw authError;
      const rawQrCode = data.totp.qr_code.trim();
      const svgPayload = rawQrCode.startsWith("data:")
        ? rawQrCode.slice(rawQrCode.indexOf(",") + 1)
        : rawQrCode;
      let decodedSvgPayload = svgPayload;
      try {
        decodedSvgPayload = decodeURIComponent(svgPayload);
      } catch {
        // Supabase may return either raw SVG or an already encoded data URL.
      }
      setFactorId(data.id);
      setQrCode(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(decodedSvgPayload)}`);
      setMfaSecret(data.totp.secret);
      setFactorVerified(false);
    }, "Scan the QR code, then enter the six-digit code.");
  };

  const verifyMfa = async () => {
    if (!factorId || mfaCode.length !== 6) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    await action(async () => {
      const client = createBrowserSupabaseClient();
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      setFactorVerified(true);
      setQrCode(null);
      setMfaCode("");
    }, "Two-step verification is active.");
  };

  const disableMfa = async () => {
    if (!factorId || mfaCode.length !== 6) {
      setError("Enter a current authenticator code before disabling two-step verification.");
      return;
    }
    await action(async () => {
      const client = createBrowserSupabaseClient();
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      setFactorId(null);
      setFactorVerified(false);
      setMfaCode("");
      setMfaSecret(null);
    }, "Two-step verification disabled.");
  };

  return (
    <SettingsShell>
      <SettingsHeader
        title="Security"
        description="Update credentials, add an authenticator, and close other signed-in sessions."
      />
      <StateMessage error={error} notice={notice} />
      {!configured ? (
        <SettingsFailure error="Supabase public authentication is not configured in the frontend environment." onRetry={() => window.location.reload()} />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-2">
          <SettingsSection title="Password" description="Choose a unique password with at least eight characters.">
            <Field label="New password">
              <input className="echo-input" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <input className="echo-input" type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </Field>
            <PrimaryButton busy={busy} onClick={() => void updatePassword()}>
              <KeyRound className="h-4 w-4" />Update password
            </PrimaryButton>
          </SettingsSection>
          <SettingsSection title="Two-step verification" description="Use a time-based authenticator app for sensitive account changes.">
            {!factorId ? (
              <PrimaryButton busy={busy} onClick={() => void beginMfa()}>
                <Smartphone className="h-4 w-4" />Set up authenticator
              </PrimaryButton>
            ) : (
              <>
                {qrCode ? (
                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center">
                    <Image src={qrCode} alt="Authenticator setup QR code" width={144} height={144} unoptimized className="rounded-xl bg-white p-2" />
                    <div>
                      <p className="text-sm leading-6 text-muted-foreground">Scan this code with your authenticator app, then enter the current six-digit code.</p>
                      {mfaSecret ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Manual setup key
                          <code className="mt-1 block select-all break-all rounded-lg bg-secondary px-3 py-2 font-mono text-foreground">
                            {mfaSecret}
                          </code>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <Field label={factorVerified ? "Current authenticator code" : "Verification code"}>
                  <input className="echo-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} />
                </Field>
                {factorVerified ? (
                  <SecondaryButton className="border-danger/30 text-danger hover:bg-danger/10" disabled={busy} onClick={() => void disableMfa()}>
                    Disable authenticator
                  </SecondaryButton>
                ) : (
                  <PrimaryButton busy={busy} onClick={() => void verifyMfa()}>Verify and enable</PrimaryButton>
                )}
              </>
            )}
          </SettingsSection>
          <SettingsSection className="2xl:col-span-2" title="Active sessions" description="Keep this device signed in and close sessions on your other devices.">
            <SettingsRow
              icon="security"
              title="Sign out other devices"
              description="Other browser and device sessions will need to authenticate again."
              action={
                <SecondaryButton
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const { error: authError } = await createBrowserSupabaseClient().auth.signOut({ scope: "others" });
                      if (authError) throw authError;
                    }, "Other sessions signed out.")
                  }
                >
                  Sign out others
                </SecondaryButton>
              }
            />
          </SettingsSection>
        </div>
      )}
    </SettingsShell>
  );
}

export function ExportSettingsView() {
  const { settings, loading, saving, error, notice, refresh, run } = useSettingsViewModel();
  const [acknowledged, setAcknowledged] = useState(false);
  const activeDeletion = settings?.deletionRequest?.status === "pending" || settings?.deletionRequest?.status === "processing";
  const activeExport = settings?.latestExport?.status === "requested" || settings?.latestExport?.status === "processing";

  const exportLabel = useMemo(() => {
    if (!settings?.latestExport) return "No export requested";
    return `${settings.latestExport.status.replace("_", " ")} · ${formatDate(settings.latestExport.requestedAt)}`;
  }, [settings]);

  return (
    <SettingsShell>
      <SettingsHeader
        title="Data & account"
        description="Request a portable copy of your records or schedule permanent account deletion."
      />
      <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />
      {loading ? (
        <LoadingState />
      ) : !settings ? (
        <SettingsFailure error={error ?? "Account controls are unavailable."} onRetry={() => void refresh()} />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-2">
          <SettingsSection title="Data export" description="A private archive can include journal metadata, Buddy conversations, moods, and settings.">
            <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
              <p className="text-sm font-semibold text-foreground">Latest request</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">{exportLabel}</p>
              {settings.latestExport?.status === "completed" ? (
                <p className="mt-2 text-xs text-primary">Available until {formatDate(settings.latestExport.expiresAt)}</p>
              ) : null}
            </div>
            <PrimaryButton
              busy={saving}
              disabled={activeExport}
              onClick={() => void run(() => settingsService.requestExport(), "Export request created.")}
            >
              <Download className="h-4 w-4" />
              {activeExport ? "Export is being prepared" : "Request private export"}
            </PrimaryButton>
          </SettingsSection>
          <SettingsSection title="Delete account" description="Deletion is scheduled with a 30-day recovery window. You can cancel while it is pending.">
            {activeDeletion && settings.deletionRequest ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/7 p-4">
                <p className="text-sm font-semibold text-danger">Deletion is {settings.deletionRequest.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">Scheduled for {formatDate(settings.deletionRequest.scheduledFor)}</p>
                {settings.deletionRequest.status === "pending" ? (
                  <SecondaryButton
                    className="mt-4"
                    disabled={saving}
                    onClick={() =>
                      void run(
                        () => settingsService.cancelDeletion(settings.deletionRequest!.id),
                        "Account deletion cancelled.",
                      )
                    }
                  >
                    Cancel deletion
                  </SecondaryButton>
                ) : null}
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/72 p-4 text-sm text-foreground">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--danger))]" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                  <span>I understand that deletion becomes permanent after the recovery window.</span>
                </label>
                <SecondaryButton
                  className="border-danger/30 text-danger hover:bg-danger/10"
                  disabled={!acknowledged || saving}
                  onClick={() => {
                    if (window.confirm("Schedule permanent deletion of your ECHO account and private records?")) {
                      void run(() => settingsService.requestDeletion(), "Account deletion scheduled.");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Schedule account deletion
                </SecondaryButton>
              </>
            )}
          </SettingsSection>
          <SettingsSection className="2xl:col-span-2" title="How requests work" description="Sensitive workflows are explicit and remain visible in Settings.">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [Download, "Request", "You start every export or deletion request."],
                [MapPin, "Track", "Status and important dates stay visible here."],
                [ShieldCheck, "Protect", "Owner-only rules keep requests tied to your account."],
              ].map(([Icon, title, copy]) => {
                const ItemIcon = Icon as typeof Download;
                return (
                  <div key={String(title)} className="rounded-2xl border border-border/70 bg-background/72 p-4">
                    <ItemIcon className="h-5 w-5 text-primary" />
                    <p className="mt-3 text-sm font-semibold">{String(title)}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(copy)}</p>
                  </div>
                );
              })}
            </div>
          </SettingsSection>
        </div>
      )}
    </SettingsShell>
  );
}
