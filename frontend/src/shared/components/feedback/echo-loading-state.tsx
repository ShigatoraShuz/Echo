import { cn } from "@/shared/lib/utils";

import { EchoSkeletonGroup } from "../ui/echo-skeleton";

interface EchoLoadingStateProps {
  label?: string;
  variant?: "spinner" | "skeleton" | "page";
  count?: number;
  className?: string;
}

interface SkeletonBlockProps {
  className?: string;
}

function SkeletonBlock({
  className,
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-xl bg-muted/70 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

function PageSkeleton() {
  return (
    <div className="w-full space-y-8">
      {/* =====================================================
          PAGE INTRO
          ===================================================== */}
      <section className="flex flex-col gap-6 border-b border-border/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-4 w-4 rounded-full" />

            <SkeletonBlock className="h-3 w-32 rounded-full" />
          </div>

          <div className="space-y-3">
            <SkeletonBlock className="h-10 w-[min(72vw,22rem)] rounded-2xl sm:h-12 sm:w-96" />

            <SkeletonBlock className="h-7 w-[min(58vw,15rem)] rounded-2xl sm:h-8 sm:w-64" />
          </div>

          <div className="space-y-2 pt-1">
            <SkeletonBlock className="h-3 w-[min(82vw,34rem)] rounded-full" />

            <SkeletonBlock className="h-3 w-[min(68vw,27rem)] rounded-full" />
          </div>
        </div>

        <div className="w-full max-w-sm rounded-[1.35rem] border border-border/60 bg-card/55 p-5 shadow-sm">
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-24 rounded-full" />

            <SkeletonBlock className="h-5 w-44 rounded-full" />

            <SkeletonBlock className="h-3 w-32 rounded-full" />
          </div>
        </div>
      </section>

      {/* =====================================================
          SUMMARY CARDS
          ===================================================== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="min-h-36 rounded-[1.5rem] border border-border/60 bg-card/60 p-5 shadow-sm"
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-3 w-24 rounded-full" />

                <SkeletonBlock className="h-9 w-9 rounded-xl" />
              </div>

              <div className="space-y-3">
                <SkeletonBlock
                  className={cn(
                    "h-8 rounded-xl",
                    index === 0 && "w-16",
                    index === 1 && "w-24",
                    index === 2 && "w-20",
                    index === 3 && "w-28",
                  )}
                />

                <SkeletonBlock className="h-3 w-32 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[1.75rem] border border-border/60 bg-card/60 p-5 shadow-sm sm:p-6">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-36 rounded-full" />

              <SkeletonBlock className="h-7 w-52 rounded-xl" />
            </div>

            <SkeletonBlock className="h-9 w-24 rounded-full" />
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.35rem] border border-border/50 bg-background/45 p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <SkeletonBlock className="h-5 w-40 rounded-lg" />

                  <SkeletonBlock className="h-6 w-16 rounded-full" />
                </div>

                <SkeletonBlock className="h-3 w-full rounded-full" />

                <SkeletonBlock className="h-3 w-[88%] rounded-full" />

                <SkeletonBlock className="h-3 w-[64%] rounded-full" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/50 bg-background/45 p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <SkeletonBlock className="h-5 w-32 rounded-lg" />

                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                </div>

                <SkeletonBlock className="h-3 w-[94%] rounded-full" />

                <SkeletonBlock className="h-3 w-[75%] rounded-full" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-border/50 bg-background/45 p-5">
              <div className="space-y-4">
                <SkeletonBlock className="h-5 w-44 rounded-lg" />

                <SkeletonBlock className="h-3 w-full rounded-full" />

                <SkeletonBlock className="h-3 w-[82%] rounded-full" />

                <SkeletonBlock className="h-3 w-[58%] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-border/60 bg-card/60 p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <SkeletonBlock className="h-5 w-32 rounded-lg" />

                <SkeletonBlock className="h-8 w-8 rounded-full" />
              </div>

              <SkeletonBlock className="h-32 w-full rounded-[1.25rem]" />

              <div className="space-y-2">
                <SkeletonBlock className="h-3 w-full rounded-full" />

                <SkeletonBlock className="h-3 w-[72%] rounded-full" />
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/60 bg-card/60 p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
              <SkeletonBlock className="h-5 w-28 rounded-lg" />

              <div className="space-y-3">
                {Array.from({
                  length: 3,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                  >
                    <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />

                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-3 w-[72%] rounded-full" />

                      <SkeletonBlock className="h-3 w-[48%] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function EchoLoadingState({
  label,
  variant = "skeleton",
  count = 4,
  className,
}: EchoLoadingStateProps) {
  return (
    <div
      className={cn(
        "w-full py-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {label ? (
        <span className="sr-only">
          {label}
        </span>
      ) : null}

      {variant === "spinner" ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary motion-reduce:animate-none"
            aria-hidden="true"
          />

          {label ? (
            <p className="text-sm text-muted-foreground">
              {label}
            </p>
          ) : null}
        </div>
      ) : variant === "page" ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-4">
          <EchoSkeletonGroup
            count={count}
          />
        </div>
      )}
    </div>
  );
}