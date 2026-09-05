export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-[rgba(83,103,51,0.16)]" />
      <span className="text-xs font-medium text-[var(--landing-muted)]">or continue with email</span>
      <span className="h-px flex-1 bg-[rgba(83,103,51,0.16)]" />
    </div>
  );
}
