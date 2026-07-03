import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/components/echo/settings-shell";

export default function ProfileSettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Profile"
          description="Manage the personal details and ECHO preferences that shape your daily check-ins."
        />

        <SettingsSection
          title="Personal Details"
          description="These sample rows use the shared ECHO settings structure and semantic theme tokens."
        >
          <SettingsRow
            icon="profile"
            title="Display name"
            description="Shown on dashboard greetings and private journal exports."
            action={<span className="text-sm font-semibold text-primary">Mira</span>}
          />
          <SettingsRow
            icon="notifications"
            title="Check-in reminders"
            description="Gentle prompts for evening journaling and morning grounding."
            action={<span className="risk-badge risk-badge-low">On</span>}
          />
          <SettingsRow
            icon="controls"
            title="Theme variant"
            description="Use the selector above to choose Calm, Night, Soft, or Focus."
            action={<span className="text-xs font-semibold text-muted-foreground">Saved locally</span>}
          />
          <SettingsRow
            icon="profile"
            title="Timezone"
            description="Used for check-in timing and weekly digest grouping."
            action={<span className="text-sm font-semibold text-primary">Asia/Manila</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
