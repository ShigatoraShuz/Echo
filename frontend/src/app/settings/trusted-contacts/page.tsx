import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/components/echo/settings-shell";

export default function TrustedContactsSettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Trusted Contacts"
          description="Prepare supportive contacts for future sharing and safety planning workflows."
        />

        <SettingsSection title="Support Circle" description="Contacts are sample rows until secure backend storage is connected.">
          <SettingsRow
            icon="contacts"
            title="Sam Rivera"
            description="Primary trusted contact for check-in planning."
            action={<span className="text-sm font-semibold text-primary">Friend</span>}
          />
          <SettingsRow
            icon="contacts"
            title="Avery Chen"
            description="Provider contact used only when the user chooses to share."
            action={<span className="text-sm font-semibold text-primary">Provider</span>}
          />
          <SettingsRow
            icon="privacy"
            title="Auto-sharing"
            description="ECHO should not auto-share private journal content."
            action={<span className="risk-badge risk-badge-low">Off</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
