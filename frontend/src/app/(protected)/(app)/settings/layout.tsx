import type { ReactNode } from "react";
import { SettingsSidebar } from "@/features/settings/components/settings-shell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:h-full lg:min-h-0">
      <SettingsSidebar />
      <div className="echo-panel-scroll min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" tabIndex={0} aria-label="Settings content">{children}</div>
    </div>
  );
}
