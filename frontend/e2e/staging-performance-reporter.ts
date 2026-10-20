import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface RouteTiming {
  navigationMs: number;
  apiResponses: Array<{ path: string; status: number; durationMs: number; requestId: string | null }>;
}

export default class StagingPerformanceReporter implements Reporter {
  private readonly samples: Array<{ project: string; route: string; navigationMs: number; apiResponses: RouteTiming["apiResponses"] }> = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((item) => item.name === "route-timing-and-api");
    if (!attachment || result.status !== "passed") return;
    try {
      const raw = attachment.body ?? (attachment.path ? readFileSync(attachment.path) : null);
      if (!raw) return;
      const timing = JSON.parse(raw.toString()) as RouteTiming;
      if (!Number.isFinite(timing.navigationMs)) return;
      this.samples.push({
        project: test.parent.project()?.name ?? "unknown", route: test.title,
        navigationMs: timing.navigationMs, apiResponses: timing.apiResponses ?? [],
      });
    } catch { /* Invalid timing evidence remains in the Playwright report for inspection. */ }
  }

  onEnd(): void {
    if (!this.samples.length) return;
    const percentile = (values: number[], fraction: number) => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.ceil(fraction * sorted.length) - 1];
    };
    const byProject = Object.fromEntries([...new Set(this.samples.map((sample) => sample.project))].map((project) => {
      const samples = this.samples.filter((sample) => sample.project === project);
      return [project, {
        routes: samples.length,
        navigationP95Ms: percentile(samples.map((sample) => sample.navigationMs), 0.95),
        apiP95Ms: percentile(samples.flatMap((sample) => sample.apiResponses.map((api) => api.durationMs)), 0.95),
        aboveThreeSeconds: samples.filter((sample) => sample.navigationMs > 3000)
          .map((sample) => ({ route: sample.route, navigationMs: sample.navigationMs })),
      }];
    }));
    const file = path.resolve(process.cwd(), "playwright-staging-performance.json");
    writeFileSync(file, JSON.stringify({ measuredAt: new Date().toISOString(), byProject, samples: this.samples }, null, 2));
  }
}
