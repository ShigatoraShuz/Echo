import { CrisisSupportPlan } from "@/shared/components/crisis";

export default function CrisisPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,hsl(var(--crisis-soft)),transparent_28rem),radial-gradient(circle_at_90%_18%,hsl(var(--secondary)/0.7),transparent_30rem),hsl(var(--background))] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-7 sm:px-6 lg:py-10">
        <CrisisSupportPlan />
      </div>
    </main>
  );
}
