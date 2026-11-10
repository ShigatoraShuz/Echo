type Lease = { id: string; state: string };
/** One owned lease, one request at a time, bounded network backoff, explicit retry. */
export function startModelLease<T extends Lease>(options: {
  acquire: () => Promise<T>;
  status: (id: string) => Promise<T>;
  heartbeat: (id: string) => Promise<T>;
  release: (id: string) => Promise<unknown>;
  change: (lease: T) => void;
  error: () => void;
  delay?: (lease: T) => number;
}) {
  let stopped = false,
    running = false,
    retryRequested = false,
    failures = 0;
  let id: string | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let renewed = 0,
    lastState = "";
  const schedule = (delay: number) => {
    if (!stopped) timer = setTimeout(() => void tick(), delay);
  };
  async function tick() {
    if (stopped || running) return;
    running = true;
    let delay = 1000;
    try {
      let lease: T;
      if (!id) {
        lease = await options.acquire();
        id = lease.id;
        renewed = Date.now();
      } else if (Date.now() - renewed >= 15000) {
        lease = await options.heartbeat(id);
        renewed = Date.now();
      } else lease = await options.status(id);
      if (stopped) {
        if (id) void options.release(id).catch(() => {});
        id = undefined;
        return;
      }
      failures = 0;
      lastState = lease.state;
      options.change(lease);
      delay = options.delay?.(lease) ?? (lease.state === "ready" || lease.state === "failed" ? 15000 : 1000);
    } catch (error) {
      if (stopped) return;
      const status = (error as { status?: number }).status;
      options.error();
      failures++;
      if (status === 404) id = undefined;
      // Never turn an authentication denial into automatic reacquisition.
      if (status === 401 || status === 403) {
        failures = 6;
        return;
      }
      if (failures >= 6) return;
      delay = Math.min(30000, 1000 * 2 ** failures);
    } finally {
      running = false;
      if (retryRequested) {
        retryRequested = false;
        failures = 0;
        schedule(0);
      } else if (!stopped && failures < 6) schedule(delay);
    }
  }
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    if (id) {
      void options.release(id).catch(() => {});
      id = undefined;
    }
  };
  const retry = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    failures = 0;
    if (!running && lastState === "failed" && id) {
      const previous = id;
      id = undefined;
      void options.release(previous).catch(() => {});
    }
    if (running) retryRequested = true;
    else void tick();
  };
  void tick();
  return { stop, retry };
}
