import { SettingsHeader, SettingsRow, SettingsSection, SettingsShell } from "@/features/settings";

export default function ExportSettingsPage() {
  return (
    <SettingsShell>
      <div className="space-y-6">
        <SettingsHeader
          title="Export"
          description="Prepare transparent data portability controls for journal entries, Buddy conversations, and settings."
        />

        <SettingsSection title="Data Export" description="Exports should be explicit, user-initiated, and clearly labeled as personal records.">
          <SettingsRow
            icon="export"
            title="Journal archive"
            description="Download entries, tags, and non-diagnostic summaries."
            action={<span className="text-sm font-semibold text-primary">Prepare</span>}
          />
          <SettingsRow
            icon="export"
            title="Buddy conversations"
            description="Export chat records separately from journal entries."
            action={<span className="text-sm font-semibold text-primary">Prepare</span>}
          />
          <SettingsRow
            icon="privacy"
            title="Deletion request"
            description="Future backend deletion should remove stored private data."
            action={<span className="risk-badge risk-badge-severe">Sensitive</span>}
          />
        </SettingsSection>
      </div>
    </SettingsShell>
  );
}
