import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/features/settings";

export default function SecuritySettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Security"
          description="Account protections for the future authenticated ECHO app."
        />

        <SettingsSection title="Account Security" description="These controls are route-ready for Supabase auth and backend sessions.">
          <SettingsRow
            icon="security"
            title="Password"
            description="Last changed in the sample account setup."
            action={<span className="text-sm font-semibold text-primary">Update</span>}
          />
          <SettingsRow
            icon="security"
            title="Two-step verification"
            description="Add an extra confirmation step for sensitive settings."
            action={<span className="risk-badge risk-badge-mild">Planned</span>}
          />
          <SettingsRow
            icon="privacy"
            title="Active sessions"
            description="Review signed-in devices once backend auth is connected."
            action={<span className="text-sm font-semibold text-primary">Review</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
