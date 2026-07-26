"use client";
import { useState } from "react";

interface OnboardingProfileFormProps {
  initialName?: string;
  onSave: (name: string) => void;
}

export function OnboardingProfileForm({ initialName = "", onSave }: OnboardingProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }
    if (trimmed.length < 2) { setError("Name must be at least 2 characters"); return; }
    setError(null);
    onSave(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">What should we call you?</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Your name" maxLength={50} />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">Continue</button>
    </form>
  );
}
