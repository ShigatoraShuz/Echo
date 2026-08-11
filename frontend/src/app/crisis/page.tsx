import { CrisisSupportPlan } from "@/shared/components/crisis";

export default function CrisisPage() {
  return (
    <main className="min-h-screen bg-crisis-soft text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-8 sm:px-6 lg:py-10">
        <CrisisSupportPlan />
      </div>
    </main>
  );
}
