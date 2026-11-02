export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 p-4 sm:p-6">
      <span className="sr-only">Opening your ECHO space…</span>
      <div aria-hidden="true" className="h-20 animate-pulse rounded-3xl bg-secondary/70 motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-secondary/50 motion-reduce:animate-none" />
        <div className="h-48 animate-pulse rounded-3xl bg-secondary/50 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
