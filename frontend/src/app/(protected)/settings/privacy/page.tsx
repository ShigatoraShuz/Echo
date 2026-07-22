import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/features/settings";

export default function PrivacySettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Privacy"
          description="Review safety, storage, and sharing controls without leaving the shared settings theme shell."
        />

        <SettingsSection
          title="Privacy Controls"
          description="Privacy surfaces keep the same card rhythm, borders, and ECHO color semantics."
        >
          <SettingsRow
            icon="privacy"
            title="Journal privacy"
            description="Entries stay private by default unless you export or share them."
            action={<span className="risk-badge risk-badge-low">Private</span>}
          />
          <SettingsRow
            icon="controls"
            title="Facial analysis"
            description="Aggregated insights only, with camera sessions started manually."
            action={<span className="risk-badge risk-badge-mild">Manual</span>}
          />
          <SettingsRow
            icon="notifications"
            title="Crisis support"
            description="Emergency resources can remain visible in high-risk states."
            action={<span className="risk-badge risk-badge-severe">Visible</span>}
          />
          <SettingsRow
            icon="export"
            title="Data export"
            description="Export controls stay explicit before backend storage is connected."
            action={<span className="text-xs font-semibold text-muted-foreground">Ready</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
