interface PasswordStrengthProps {
  strength: { score: number; label: string };
}

export function PasswordStrength({ strength }: PasswordStrengthProps) {
  if (!strength.label) return null;

  const colorMap: Record<string, string> = {
    Weak: "bg-danger",
    Fair: "bg-warning",
    Moderate: "bg-warning",
    Strong: "bg-success",
  };

  const barColor = colorMap[strength.label] ?? "bg-muted";

  return (
    <div className="space-y-1" aria-label={`Password strength: ${strength.label}`}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full ${strength.score >= segment * 25 ? barColor : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{strength.label}</span>
      </p>
    </div>
  );
}
