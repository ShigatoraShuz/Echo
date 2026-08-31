"use client";

interface PreferredNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PreferredNameInput({ value, onChange }: PreferredNameInputProps) {
  const maxLength = 30;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">Preferred name (optional)</label>
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, maxLength))} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="How we should address you" maxLength={maxLength} />
      <p className="text-xs text-muted-foreground text-right">{value.length}/{maxLength}</p>
    </div>
  );
}
