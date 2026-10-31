import type { ProfessionalEventService } from "./professional-events.service.js";

type Event = { event: string; [key: string]: string | number | boolean | null };
/** Server-owned lifecycle only. No HTTP route, overlapping runs, or automatic failed-event replay. */
export function startProfessionalEventProcessor(
  service: Pick<ProfessionalEventService, "runBatch">,
  options: { enabled: boolean; httpOnly: boolean; intervalMs?: number; report: (event: Event) => void },
) {
  let stopped = false;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const interval = Math.max(30_000, options.intervalMs ?? 30_000);
  const enabled = options.enabled && !options.httpOnly;
  const tick = (): Promise<void> => {
    if (stopped || !enabled) return Promise.resolve();
    if (running) return running;
    running = Promise.resolve().then(async () => {
      try {
        const result = await service.runBatch();
        options.report({ event: "batch_completed", ...result });
      } catch {
        options.report({ event: "batch_failed" });
      } finally {
        running = undefined;
        if (!stopped) {
          timer = setTimeout(() => { void tick(); }, interval);
          timer.unref();
        }
      }
    });
    return running;
  };
  options.report({ event: enabled ? "processor_started" : "processor_disabled", enabled, intervalMs: interval });
  // Immediate startup recovery; every later batch is scheduled after completion.
  if (enabled) void tick();
  return { stop: async () => { stopped = true; if (timer) clearTimeout(timer); await running; } };
}
