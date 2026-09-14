import { LoadingState } from "@/shared/components/feedback";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <LoadingState label="Loading your ECHO space" />
      </div>
    </main>
  );
}