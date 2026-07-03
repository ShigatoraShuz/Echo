import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/components/echo/settings-shell";

export default function NotificationSettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Notifications"
          description="Choose reminder surfaces that stay private and do not reveal sensitive journal content."
        />

        <SettingsSection title="Reminder Preferences" description="All copy should remain gentle, private, and easy to turn off.">
          <SettingsRow
            icon="notifications"
            title="Evening journal check-in"
            description="A quiet reminder around your preferred reflection time."
            action={<span className="risk-badge risk-badge-low">On</span>}
          />
          <SettingsRow
            icon="notifications"
            title="Grounding practice"
            description="Optional daily breathing or grounding prompt."
            action={<span className="risk-badge risk-badge-mild">Optional</span>}
          />
          <SettingsRow
            icon="privacy"
            title="Lock screen privacy"
            description="Hide journal-specific wording from notification previews."
            action={<span className="risk-badge risk-badge-low">Hidden</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
