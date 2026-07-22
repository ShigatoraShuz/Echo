import { LoadingState } from "@/shared/components/legacy";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl">
        <LoadingState label="Loading ECHO safely..." />
      </div>
    </main>
  );
}
