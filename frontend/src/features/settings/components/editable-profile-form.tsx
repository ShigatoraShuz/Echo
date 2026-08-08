"use client";
import { useState } from "react";
import type { ProfileSettings } from "../model/settings.model";

interface EditableProfileProps {
  profile: ProfileSettings;
  onSave: (updates: Partial<ProfileSettings>) => Promise<void>;
  isSaving: boolean;
}

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo",
];

export function EditableProfileForm({ profile, onSave, isSaving }: EditableProfileProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [timezone, setTimezone] = useState(profile.timezone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ displayName, timezone });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="profile-display-name" className="text-sm font-medium text-foreground">Display name</label>
        <input id="profile-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      <div>
        <label htmlFor="profile-timezone" className="text-sm font-medium text-foreground">Timezone</label>
        <select id="profile-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>
      <button type="submit" disabled={isSaving} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
