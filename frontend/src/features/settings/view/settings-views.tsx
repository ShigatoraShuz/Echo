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
  UsersRound,
  ShieldAlert,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getSupabasePublicConfig } from "@/infrastructure/supabase/config";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { cn } from "@/shared/lib/utils";
import { EchoButton } from "@/shared/components/ui/echo-button";

import {
  AvatarUpload,
  ExportDataSection,
  SettingsHeader,
  SettingsRow,
  SettingsSection,
  SettingsShell,
} from "../components";

import { useSettingsViewModel } from "../view-model/use-settings-view-model";

import type {
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
  TrustedContact,
  TrustedContactInput,
} from "../model/settings.model";

import { settingsService } from "@/services/settings/settings.service";
import { getJournalService } from "@/services/journal/journal-service.factory";

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// UI UTILITIES
// -----------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// -----------------------------------------------------------------------------
// STATE MESSAGE
// -----------------------------------------------------------------------------

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
        "mb-6 flex w-full min-w-0 flex-col gap-3",
        "rounded-[1.25rem] border px-4 py-3 text-sm",
        "animate-in fade-in slide-in-from-top-2",
        "sm:flex-row sm:items-center sm:justify-between",
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      <span className="flex min-w-0 items-start gap-2 font-medium">
        {error ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
        )}

        <span className="min-w-0 break-words">
          {error ?? notice}
        </span>
      </span>

      {error && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="
            self-start
            text-xs
            font-bold
            uppercase
            tracking-wider
            underline
            underline-offset-4
            sm:self-auto
          "
        >
          Retry
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MOBILE-FRIENDLY TOGGLE
// -----------------------------------------------------------------------------

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
    <div
      className={cn(
        /*
         * MOBILE
         * ------
         * Content is stacked vertically so the switch can never overlap
         * the label or description.
         */
        "flex w-full min-w-0 flex-col gap-4",

        /*
         * Card styling
         */
        "rounded-[1.25rem] border border-border/70",
        "bg-background/72 p-4",

        /*
         * Smooth interaction
         */
        "transition-all duration-200",
        "hover:border-primary/20",

        /*
         * TABLET / DESKTOP
         * ----------------
         * Restore horizontal layout.
         */
        "sm:flex-row sm:items-center sm:justify-between",
        "sm:gap-5",
        "sm:rounded-[1.5rem]",
        "sm:p-5",

        disabled && "pointer-events-none opacity-50 grayscale",
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* TEXT                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="min-w-0 flex-1">
        <p
          className="
            break-words
            text-sm
            font-bold
            leading-5
            text-foreground
          "
        >
          {label}
        </p>

        <p
          className="
            mt-1
            break-words
            text-[11px]
            leading-relaxed
            text-muted-foreground
            sm:text-xs
          "
        >
          {description}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SWITCH                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          flex
          w-full
          shrink-0
          justify-end
          sm:w-auto
          sm:justify-center
        "
      >
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            /*
             * FIXED WIDTH + HEIGHT
             *
             * This prevents the toggle from shrinking when the text
             * becomes long.
             */
            "relative h-7 w-12 shrink-0",

            "rounded-full",
            "outline-none",

            "transition-all duration-300",

            "focus-visible:ring-4",
            "focus-visible:ring-primary/20",

            checked
              ? "bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.2)]"
              : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "absolute left-0 top-1",
              "h-5 w-5",
              "rounded-full",
              "bg-white",
              "shadow-md",
              "transition-transform duration-300",
              "ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              checked
                ? "translate-x-6"
                : "translate-x-1",
            )}
          />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FIELD
// -----------------------------------------------------------------------------

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
    <div className="w-full min-w-0 space-y-1.5">
      <label
        className="
          ml-1
          block
          text-[11px]
          font-black
          uppercase
          tracking-[0.12em]
          text-muted-foreground
        "
      >
        {label}
      </label>

      <div className="w-full min-w-0">
        {children}
      </div>

      {hint && (
        <p
          className="
            ml-1
            break-words
            text-[10px]
            leading-relaxed
            text-muted-foreground
          "
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// RESPONSIVE ACTION CONTAINER
// -----------------------------------------------------------------------------

function SettingsAction({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="
        flex
        w-full
        justify-stretch
        pt-6
        sm:justify-end
        sm:pt-8
      "
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// PROFILE SETTINGS
// -----------------------------------------------------------------------------

export function ProfileSettingsView() {
  const {
    settings,
    loading,
    saving,
    error,
    notice,
    refresh,
    run,
  } = useSettingsViewModel();

  const [form, setForm] =
    useState<ProfileSettings | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings.profile);
    }
  }, [settings?.profile]);

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setIsUploadingAvatar(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setForm((prev) => prev ? { ...prev, avatarPath: dataUrl } : prev);
        if (form) {
          await settingsService.updateProfile({ ...form, avatarPath: dataUrl });
        }
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [form],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form) {
      await run(
        () => settingsService.updateProfile(form),
        "Profile updated.",
      );
    }
  };

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div
        className="
          flex
          min-h-[200px]
          w-full
          items-center
          justify-center
          px-4
          py-12
          sm:py-20
        "
      >
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW
  // ---------------------------------------------------------------------------

  return (
    <SettingsShell>
      <div className="w-full min-w-0">
        <SettingsHeader
          title="Profile"
          description="Manage your dashboard identity and local time preferences."
        />

        <StateMessage
          error={error}
          notice={notice}
          onRetry={() => void refresh()}
        />

        {form && (
          <form
            onSubmit={submit}
            className="
              w-full
              min-w-0
              space-y-5
              sm:space-y-6
            "
          >
            <SettingsSection
              title="Profile Photo"
              description="Change how you appear in ECHO."
            >
              {form && (
                <AvatarUpload
                  currentAvatar={form.avatarPath ?? null}
                  displayName={form.displayName}
                  onUpload={handleAvatarUpload}
                  isUploading={isUploadingAvatar}
                />
              )}
            </SettingsSection>

            <SettingsSection
              title="Personal details"
              description="Ensuring ECHO feels personal and timely."
            >
              {/* ------------------------------------------------------------ */}
              {/* FORM GRID                                                     */}
              {/* ------------------------------------------------------------ */}

              <div
                className="
                  grid
                  w-full
                  min-w-0
                  grid-cols-1
                  gap-5
                  sm:grid-cols-2
                "
              >
                {/* Display Name */}
                <Field label="Display name">
                  <div className="relative w-full min-w-0">
                    <UserRound
                      className="
                        pointer-events-none
                        absolute
                        left-4
                        top-1/2
                        h-4
                        w-4
                        -translate-y-1/2
                        text-primary
                      "
                    />

                    <input
                      className="
                        echo-input
                        h-11
                        w-full
                        min-w-0
                        rounded-xl
                        pl-11
                        pr-4
                      "
                      value={form.displayName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          displayName:
                            e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </Field>

                {/* Timezone */}
                <Field
                  label="Timezone"
                  hint="Used for daily check-in reminders."
                >
                  <select
                    className="
                      echo-input
                      h-11
                      w-full
                      min-w-0
                      rounded-xl
                      px-3
                    "
                    value={form.timezone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        timezone:
                          e.target.value,
                      })
                    }
                  >
                    {timezoneOptions.map((tz) => (
                      <option
                        key={tz}
                        value={tz}
                      >
                        {tz.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* ACTION                                                        */}
              {/* ------------------------------------------------------------ */}

              <SettingsAction>
                <EchoButton
                  type="submit"
                  variant="primary"
                  isLoading={saving}
                  className="
                    h-11
                    w-full
                    rounded-full
                    px-8
                    sm:w-auto
                  "
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </EchoButton>
              </SettingsAction>
            </SettingsSection>
          </form>
        )}
      </div>
    </SettingsShell>
  );
}

// -----------------------------------------------------------------------------
// PRIVACY SETTINGS
// -----------------------------------------------------------------------------

export function PrivacySettingsView() {
  const {
    settings,
    loading,
    saving,
    error,
    notice,
    refresh,
    run,
  } = useSettingsViewModel();

  const [form, setForm] =
    useState<
      Omit<PrivacySettings, "journalPrivate">
    | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        facialAnalysisEnabled:
          settings.privacy
            .facialAnalysisEnabled,

        crisisSupportVisible:
          settings.privacy
            .crisisSupportVisible,

        lockScreenPrivate:
          settings.privacy
            .lockScreenPrivate,
      });
    }
  }, [settings]);

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div
        className="
          flex
          min-h-[200px]
          w-full
          items-center
          justify-center
          px-4
          py-12
          sm:py-20
        "
      >
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW
  // ---------------------------------------------------------------------------

  return (
    <SettingsShell>
      <div className="w-full min-w-0">
        <SettingsHeader
          title="Privacy"
          description="Customize how wellbeing features interact with your device."
        />

        <StateMessage
          error={error}
          notice={notice}
          onRetry={() => void refresh()}
        />

        {form && (
          <SettingsSection
            title="Safety Controls"
            description="Your journal entries are always encrypted and private."
          >
            {/* -------------------------------------------------------------- */}
            {/* TOGGLES                                                         */}
            {/* -------------------------------------------------------------- */}

            <div
              className="
                grid
                w-full
                min-w-0
                grid-cols-1
                gap-3
                sm:gap-4
              "
            >
              <Toggle
                checked
                disabled
                onChange={() => {}}
                label="Encrypted Records"
                description="Content is owner-scoped. We cannot read your private thoughts."
              />

              <Toggle
                checked={
                  form.facialAnalysisEnabled
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    facialAnalysisEnabled:
                      value,
                  })
                }
                label="Facial Check-ins"
                description="Enable camera-based emotion tracking during reflections."
              />

              <Toggle
                checked={
                  form.crisisSupportVisible
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    crisisSupportVisible:
                      value,
                  })
                }
                label="Local Support Links"
                description="Show help resources during periods of higher distress."
              />

              <Toggle
                checked={
                  form.lockScreenPrivate
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    lockScreenPrivate:
                      value,
                  })
                }
                label="Masked Alerts"
                description="Prevent journal titles from showing on your lock screen."
              />
            </div>

            {/* -------------------------------------------------------------- */}
            {/* SAVE                                                            */}
            {/* -------------------------------------------------------------- */}

            <SettingsAction>
              <EchoButton
                onClick={() =>
                  void run(
                    () =>
                      settingsService.updatePrivacy(
                        form,
                      ),
                    "Privacy choices saved.",
                  )
                }
                variant="primary"
                isLoading={saving}
                className="
                  h-11
                  w-full
                  rounded-full
                  px-8
                  sm:w-auto
                "
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Save Privacy
              </EchoButton>
            </SettingsAction>
          </SettingsSection>
        )}
      </div>
    </SettingsShell>
  );
}

// -----------------------------------------------------------------------------
// NOTIFICATION SETTINGS
// -----------------------------------------------------------------------------

export function NotificationSettingsView() {
  const {
    settings,
    loading,
    saving,
    error,
    notice,
    refresh,
    run,
  } = useSettingsViewModel();

  const [form, setForm] =
    useState<NotificationSettings | null>(
      null,
    );

  useEffect(() => {
    if (settings) {
      setForm(settings.notifications);
    }
  }, [settings]);

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div
        className="
          flex
          min-h-[200px]
          w-full
          items-center
          justify-center
          px-4
          py-12
          sm:py-20
        "
      >
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isReminderOn = Boolean(
    form?.journalRemindersEnabled ||
      form?.wellbeingRemindersEnabled,
  );

  // ---------------------------------------------------------------------------
  // VIEW
  // ---------------------------------------------------------------------------

  return (
    <SettingsShell>
      <div className="w-full min-w-0">
        <SettingsHeader
          title="Notifications"
          description="Find your rhythm with quiet, neutral reminders."
        />

        <StateMessage
          error={error}
          notice={notice}
          onRetry={() => void refresh()}
        />

        {form && (
          <SettingsSection
            title="Reminder Rhythm"
            description="You can pause or change these at any time."
          >
            {/* -------------------------------------------------------------- */}
            {/* NOTIFICATION TOGGLES                                           */}
            {/* -------------------------------------------------------------- */}

            <div
              className="
                grid
                w-full
                min-w-0
                grid-cols-1
                gap-3
                sm:gap-4
                lg:grid-cols-2
              "
            >
              <Toggle
                checked={
                  form.journalRemindersEnabled
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    journalRemindersEnabled:
                      value,
                  })
                }
                label="Daily Check-in"
                description="A quiet nudge to write."
              />

              <Toggle
                checked={form.pushEnabled}
                onChange={(value) =>
                  setForm({
                    ...form,
                    pushEnabled: value,
                  })
                }
                label="Push Notifications"
                description="Device-level reminders."
              />

              <Toggle
                checked={form.emailEnabled}
                onChange={(value) =>
                  setForm({
                    ...form,
                    emailEnabled: value,
                  })
                }
                label="Email Alerts"
                description="Account-related news."
              />

              <Toggle
                checked={
                  form.wellbeingRemindersEnabled
                }
                onChange={(value) =>
                  setForm({
                    ...form,
                    wellbeingRemindersEnabled:
                      value,
                  })
                }
                label="Grounding Invitations"
                description="Short breathing prompts."
              />
            </div>

            {/* -------------------------------------------------------------- */}
            {/* REMINDER DETAILS                                                */}
            {/* -------------------------------------------------------------- */}

            <div
              className={cn(
                "mt-5 grid w-full min-w-0 grid-cols-1 gap-5",

                "rounded-[1.5rem]",
                "border border-slate-100",
                "bg-slate-50/50",
                "p-4",

                "transition-opacity duration-300",

                "sm:mt-6",
                "sm:grid-cols-2",
                "sm:gap-5",
                "sm:rounded-[2rem]",
                "sm:p-5",

                !isReminderOn &&
                  "pointer-events-none opacity-50 grayscale",
              )}
            >
              {/* Target Time */}
              <Field label="Target Time">
                <input
                  type="time"
                  className="
                    echo-input
                    h-11
                    w-full
                    min-w-0
                    rounded-xl
                  "
                  value={
                    form.reminderTime ?? ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reminderTime:
                        e.target.value ||
                        null,
                    })
                  }
                />
              </Field>

              {/* Target Timezone */}
              <Field label="Target Timezone">
                <select
                  className="
                    echo-input
                    h-11
                    w-full
                    min-w-0
                    rounded-xl
                  "
                  value={
                    form.reminderTimezone ?? ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reminderTimezone:
                        e.target.value,
                    })
                  }
                >
                  {timezoneOptions.map(
                    (tz) => (
                      <option
                        key={tz}
                        value={tz}
                      >
                        {tz.replace(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* SAVE                                                            */}
            {/* -------------------------------------------------------------- */}

            <SettingsAction>
              <EchoButton
                onClick={() =>
                  void run(
                    () =>
                      settingsService.updateNotifications(
                        form,
                      ),
                    "Notifications saved.",
                  )
                }
                variant="primary"
                isLoading={saving}
                disabled={
                  isReminderOn &&
                  !form.reminderTime
                }
                className="
                  h-11
                  w-full
                  rounded-full
                  px-8
                  sm:w-auto
                "
              >
                <Bell className="mr-2 h-4 w-4" />
                Save Reminders
              </EchoButton>
            </SettingsAction>
          </SettingsSection>
        )}
      </div>
    </SettingsShell>
  );
}

// -----------------------------------------------------------------------------
// SECURITY SETTINGS
// -----------------------------------------------------------------------------

export function SecuritySettingsView() {
  const supabase = createBrowserSupabaseClient();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function sendPasswordReset() {
    if (!email) return;
    setStatus("sending");
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (resetError) throw resetError;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Password reset failed.");
    }
  }

  return (
    <SettingsShell>
      <div className="w-full min-w-0">
        <SettingsHeader
          title="Security"
          description="Manage your account authentication and access."
        />

        <SettingsSection
          title="Password & Authentication"
          description="Your ECHO account is secured via Supabase Auth."
        >
          <div className="flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Change Password</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {email ?? "Loading…"}
                </p>
              </div>
            </div>

            {status === "sent" ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-4 py-3 text-sm text-primary">
                <Check className="h-4 w-4 shrink-0" />
                Password reset link sent to {email}. Check your inbox.
              </div>
            ) : (
              <EchoButton
                type="button"
                variant="primary"
                isLoading={status === "sending"}
                onClick={() => void sendPasswordReset()}
                className="h-11 w-full rounded-full px-8 sm:w-auto"
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Reset Email
              </EchoButton>
            )}

            {status === "error" && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="mt-4 flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Two-Factor Authentication</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Additional security layer for your account.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              2FA is managed via your Supabase account settings. Contact support to enable it.
            </p>
          </div>
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}

// -----------------------------------------------------------------------------
// TRUSTED CONTACTS SETTINGS
// -----------------------------------------------------------------------------

export function TrustedContactsSettingsView() {
  const {
    settings,
    loading,
    saving,
    error,
    notice,
    refresh,
    run,
  } = useSettingsViewModel();

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<TrustedContactInput>({
    contactName: "",
    contactEmail: null,
    contactPhone: null,
    relationship: "",
    isPrimary: false,
    permissionAcknowledged: false,
  });

  const RELATIONSHIP_SUGGESTIONS = [
    "Therapist",
    "Partner",
    "Parent",
    "Close Friend",
    "Doctor",
    "Sibling",
    "Counselor",
  ];

  useEffect(() => {
    if (settings) setContacts(settings.trustedContacts);
  }, [settings]);

  const resetForm = () => {
    setForm({
      contactName: "",
      contactEmail: null,
      contactPhone: null,
      relationship: "",
      isPrimary: false,
      permissionAcknowledged: false,
    });
    setAddMode(false);
    setEditId(null);
  };

  const hasContactMethod = Boolean(
    (form.contactEmail && form.contactEmail.trim().length > 0) ||
      (form.contactPhone && form.contactPhone.trim().length > 0),
  );

  const isFormValid =
    Boolean(form.contactName.trim()) &&
    Boolean(form.relationship.trim()) &&
    hasContactMethod &&
    form.permissionAcknowledged;

  async function handleSave() {
    if (!isFormValid) return;
    if (editId) {
      await run(
        () => settingsService.updateContact(editId, form),
        "Contact updated.",
      );
    } else {
      await run(
        () => settingsService.createContact(form),
        "Contact added to your support circle.",
      );
    }
    resetForm();
    void refresh();
  }

  async function handleSetPrimary(contact: TrustedContact) {
    await run(
      () =>
        settingsService.updateContact(contact.id, {
          contactName: contact.contactName,
          contactEmail: contact.contactEmail,
          contactPhone: contact.contactPhone,
          relationship: contact.relationship,
          isPrimary: true,
          permissionAcknowledged: contact.permissionAcknowledged,
        }),
      `${contact.contactName} is now your primary contact.`,
    );
    void refresh();
  }

  async function handleRemove(id: string) {
    await run(() => settingsService.removeContact(id), "Contact removed.");
    setDeleteConfirmId(null);
    void refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SettingsShell>
      <div className="w-full min-w-0 space-y-6">
        <SettingsHeader
          title="Trusted Contacts"
          description="People ECHO may reach in moments of high distress."
        />

        <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />

        {/* Safety Net info banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
              <strong className="block font-semibold text-foreground">
                How ECHO uses your support circle
              </strong>
              <p className="mt-1">
                Your trusted contacts will only be displayed or notified if you experience elevated distress or choose to initiate contact. Your reflections remain private and are never shared automatically.
              </p>
              <Link
                href="/crisis"
                className="mt-2 inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
              >
                View your Crisis Support Plan &rarr;
              </Link>
            </div>
          </div>
        </div>

        <SettingsSection
          title="Your support circle"
          description="Contacts are notified only if you grant explicit permission."
        >
          {/* Contact list */}
          <div className="w-full space-y-3">
            {contacts.length === 0 && !addMode && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-semibold text-foreground">No trusted contacts yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add someone you trust (such as a therapist, close friend, or family member) to reach out in tough moments.
                </p>
              </div>
            )}

            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{contact.contactName}</p>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                      {contact.relationship}
                    </span>
                    {contact.isPrimary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Check className="h-3 w-3" /> Primary Contact
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {contact.contactPhone && (
                      <p className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        {contact.contactPhone}
                      </p>
                    )}
                    {contact.contactEmail && (
                      <p className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        {contact.contactEmail}
                      </p>
                    )}
                  </div>
                </div>

                {deleteConfirmId === contact.id ? (
                  <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-2">
                    <span className="text-xs font-semibold text-destructive">Remove?</span>
                    <button
                      type="button"
                      onClick={() => void handleRemove(contact.id)}
                      className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-bold text-white hover:bg-destructive/90"
                    >
                      Yes, Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {!contact.isPrimary && (
                      <button
                        type="button"
                        onClick={() => void handleSetPrimary(contact)}
                        className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Set as Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(contact.id);
                        setForm({
                          contactName: contact.contactName,
                          contactEmail: contact.contactEmail,
                          contactPhone: contact.contactPhone,
                          relationship: contact.relationship,
                          isPrimary: contact.isPrimary,
                          permissionAcknowledged: contact.permissionAcknowledged,
                        });
                        setAddMode(true);
                      }}
                      className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(contact.id)}
                      className="flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/8 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add/Edit form */}
          {addMode ? (
            <div className="mt-5 w-full rounded-2xl border border-primary/20 bg-card p-5 space-y-4 shadow-sm">
              <p className="text-sm font-bold text-foreground">
                {editId ? "Edit Trusted Contact" : "Add a Trusted Contact"}
              </p>

              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name">
                  <input
                    className="echo-input h-11 w-full min-w-0 rounded-xl px-4"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="e.g. Dr. Sarah Smith"
                  />
                </Field>

                <div className="space-y-1.5">
                  <Field label="Relationship">
                    <input
                      className="echo-input h-11 w-full min-w-0 rounded-xl px-4"
                      value={form.relationship}
                      onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                      placeholder="e.g. Therapist, Partner"
                    />
                  </Field>

                  {/* Relationship suggestion chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {RELATIONSHIP_SUGGESTIONS.map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setForm({ ...form, relationship: rel })}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                          form.relationship === rel
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-secondary/70 text-secondary-foreground hover:bg-secondary",
                        )}
                      >
                        {rel}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Phone number">
                  <input
                    type="tel"
                    className="echo-input h-11 w-full min-w-0 rounded-xl px-4"
                    value={form.contactPhone ?? ""}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value || null })}
                    placeholder="+1 (555) 000-0000"
                  />
                </Field>

                <Field label="Email address">
                  <input
                    type="email"
                    className="echo-input h-11 w-full min-w-0 rounded-xl px-4"
                    value={form.contactEmail ?? ""}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value || null })}
                    placeholder="contact@example.com"
                  />
                </Field>
              </div>

              {!hasContactMethod && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Please provide at least a phone number or email address.
                </p>
              )}

              {/* Primary toggle */}
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="font-medium">Set as primary contact</span>
                <span className="text-muted-foreground">(contacted first during crisis support)</span>
              </label>

              {/* Permission acknowledgement */}
              <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.permissionAcknowledged}
                  onChange={(e) => setForm({ ...form, permissionAcknowledged: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded accent-primary shrink-0"
                />
                <span className="leading-relaxed">
                  I have informed this person that ECHO may contact them on my behalf during elevated distress moments.
                </span>
              </label>

              {/* Form buttons */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <EchoButton
                  type="button"
                  variant="primary"
                  isLoading={saving}
                  disabled={!isFormValid}
                  onClick={() => void handleSave()}
                  className="h-11 w-full rounded-full px-8 sm:w-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {editId ? "Save Changes" : "Add Contact"}
                </EchoButton>
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 rounded-full border border-border/60 px-8 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => { setAddMode(true); setEditId(null); }}
                className="flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/4 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/8 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Trusted Contact
              </button>
            </div>
          )}
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}

// -----------------------------------------------------------------------------
// DATA EXPORT SETTINGS
// -----------------------------------------------------------------------------

export function ExportSettingsView() {
  const {
    settings,
    loading,
    error,
    notice,
    refresh,
    run,
  } = useSettingsViewModel();

  const journalService = useMemo(() => getJournalService(), []);

  const loadAllEntries = useCallback(async () => {
    const result = await journalService.listEntries(
      { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      1,
      200,
    );
    if (!result.success) return [];
    return result.data.entries;
  }, [journalService]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SettingsShell>
      <div className="w-full min-w-0">
        <SettingsHeader
          title="Data Export"
          description="Download a personal copy of your ECHO wellbeing data."
        />

        <StateMessage error={error} notice={notice} onRetry={() => void refresh()} />

        <SettingsSection
          title="PDF Report"
          description="A private, watermarked export only visible to you."
        >
          <ExportDataSection
            profile={settings?.profile ?? null}
            onRequestExport={async () => {
              const req = await settingsService.requestExport();
              void refresh();
              return req;
            }}
            loadJournalEntries={loadAllEntries}
          />
        </SettingsSection>

        {settings?.latestExport && (
          <SettingsSection
            title="Previous Export"
            description="History of your last data export request."
          >
            <div className="flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border/60 bg-card p-4">
              <Download className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground capitalize">
                  {settings.latestExport.status}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Requested {formatDate(settings.latestExport.requestedAt)}
                </p>
                {settings.latestExport.expiresAt && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Expires {formatDate(settings.latestExport.expiresAt)}
                  </p>
                )}
              </div>
            </div>
          </SettingsSection>
        )}

        <SettingsSection
          title="Account Deletion"
          description="Once deleted, your data cannot be recovered."
        >
          {settings?.deletionRequest ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-bold text-destructive">
                    Deletion Scheduled
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your account is scheduled for deletion.
                    {settings.deletionRequest.scheduledFor && (
                      <> Scheduled for {formatDate(settings.deletionRequest.scheduledFor)}.</>
                    )}
                  </p>
                </div>
              </div>
              <EchoButton
                type="button"
                variant="primary"
                onClick={() =>
                  void run(
                    () => settingsService.cancelDeletion(settings.deletionRequest!.id),
                    "Deletion request cancelled.",
                  )
                }
                className="h-11 w-full rounded-full px-8 sm:w-auto"
              >
                Cancel Deletion
              </EchoButton>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border border-destructive/15 bg-card p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive/70" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Delete your account
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    This will permanently remove your profile, all journal entries, AI analyses, and
                    chat history. This action cannot be undone.
                  </p>
                </div>
              </div>
              <EchoButton
                type="button"
                variant="danger"
                onClick={() =>
                  void run(
                    () => settingsService.requestDeletion(),
                    "Deletion requested. You can cancel within 30 days.",
                  )
                }
                className="h-11 w-full rounded-full border-destructive bg-destructive/10 px-8 text-destructive hover:bg-destructive hover:text-white sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Request Account Deletion
              </EchoButton>
            </div>
          )}
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}