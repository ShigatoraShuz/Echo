export class DevelopmentAnalysisRunner {
  private readonly queue: Array<() => Promise<void>> = [];
  private active = 0;
  private stopped = false;
  private readonly cancellation = new AbortController();
  get signal(): AbortSignal {
    return this.cancellation.signal;
  }

  constructor(private readonly concurrency: number) {}

  enqueue(task: () => Promise<void>): void {
    if (this.stopped || this.queue.length >= 1000) return;
    this.queue.push(task);
    this.drain();
  }

  stop(): void {
    this.stopped = true;
    this.queue.length = 0;
    this.cancellation.abort();
  }
  get snapshot() {
    return { active: this.active, queued: this.queue.length, stopped: this.stopped };
  }

  private drain(): void {
    while (!this.stopped && this.active < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      if (!task) return;
      this.active += 1;
      void task()
        .catch(() => undefined)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}
