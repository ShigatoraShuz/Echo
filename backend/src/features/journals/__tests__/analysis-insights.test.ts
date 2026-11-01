import { describe, expect, it, vi } from "vitest";
import native from "../../../../../packages/contracts/fixtures/core-v2.json";
import pipeline from "../../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { type JournalAnalysisResult, journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema, modelPipelineResultSchema } from "@echo/contracts";
import { analysisTrends } from "../analysis-insights.js";
import { JournalService } from "../journals.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { sealAnalysisResult } from "../../../infrastructure/encryption/analysis-result-encryption.js";

const result = journalAnalysisV2ResultSchema.parse(native);
const partial = journalAnalysisV3ResultSchema.parse({ ...native, schemaVersion: "echo-journal-analysis-v3", journalScreening: {
  status: "available", experimental: true, inferenceVersion: "fictional-test", items: {
    anhedonia: null, depressed_mood: null, sleep: 0, fatigue: null, appetite: null, worthlessness_guilt: null, concentration: null, psychomotor: null,
  }, coverage: 1, subtotal: 0, total: null,
} });
const realPipeline = modelPipelineResultSchema.parse({ ...pipeline, isSimulated: false,
  stages: Object.fromEntries(Object.entries(pipeline.stages).map(([k, v]) => [k, { ...v, executionMode: "real" }])) });
const dated = (id: string, date: string, output: JournalAnalysisResult = result) => ({ id, createdAt: date, result: output });

describe("authorized persisted analysis trends", () => {
  it("uses chronological actual dates, latest daily result, and keeps native categories separate from severity", () => {
    const data = analysisTrends([dated("late", "2026-10-31T03:00:00Z", partial), dated("early", "2026-10-01T00:00:00Z"), dated("same-day-old", "2026-10-31T01:00:00Z")]);
    expect(data.emotionTrend.map(p => p.date)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(data.emotionTrend[0].values.joy).toBe(result.emotionDistribution[0].value);
    expect(data.categoryTrend?.map(p => p.label)).toEqual([result.distressCategory, result.distressCategory]);
    expect(data.distressTrend).toEqual([]);
    expect(data.journalScreeningTrend).toEqual([{ date: "2026-10-31", status: "available", coverage: 1, subtotal: 0, total: null }]);
  });
  it("uses actual UTC instants instead of lexical ordering across timezone offsets", () => {
    const earlier = { ...result, emotionDistribution: result.emotionDistribution.map(x => ({ ...x, value: 0.125 })) };
    const data = analysisTrends([dated("later-utc", "2026-10-30T23:30:00-02:00"), dated("earlier-utc", "2026-10-31T00:30:00Z", earlier)]);
    expect(data.emotionTrend).toHaveLength(1);
    expect(data.emotionTrend[0].date).toBe("2026-10-31");
    expect(data.emotionTrend[0].values.joy).toBe(result.emotionDistribution[0].value);
  });
  it("does not create points for absent outputs or synthetic results", () => {
    expect(analysisTrends([])).toEqual({ emotionTrend: [], distressTrend: [], categoryTrend: [], journalScreeningTrend: [] });
    expect(analysisTrends([{ id: "fixture", createdAt: "2026-10-31T01:00:00Z", result: modelPipelineResultSchema.parse(pipeline) }]).emotionTrend).toEqual([]);
  });
  it("retains independent pipeline outputs with the checkpoint labels, not an invented clinical band", () => {
    const data = analysisTrends([{ id: "fictional-pipeline", createdAt: "2026-10-31T00:00:00Z", result: realPipeline }]);
    expect(data.distressTrend).toEqual([]);
    expect(data.categoryTrend?.[0]?.label).toBe(realPipeline.stages.distress.result?.topFive[0]?.label);
    expect(data.emotionTrend[0]?.values).toEqual(Object.fromEntries(realPipeline.stages.peak.result!.scores.map(s => [s.label, s.probability])));
  });
  it("keeps changed model identities on the same day separate", () => {
    const changed = { ...result, models: { ...result.models, e4: { ...result.models.e4, modelVersion: "fictional-other-model" } } };
    expect(analysisTrends([dated("one", "2026-10-31T01:00:00Z"), dated("two", "2026-10-31T02:00:00Z", changed)]).emotionTrend).toHaveLength(2);
  });
});

// In-memory query engine, sealed fictional payloads, no client, credentials, server or database access.
function harness(failure = false, count?: number) {
  const encryption = createEncryptionService(Buffer.alloc(32, 3).toString("base64"), 1);
  const payload = { ciphertext: sealAnalysisResult(result, encryption).encryptedPayload };
  const request = (owner: string, status = "completed", deleted: string | null = null) => ({ user_id: owner, status, deleted_at: deleted, facial_status: "not_requested" });
  const rows = [
    { id: "old-real", user_id: "owner", is_simulated: false, created_at: "2000-01-01T00:00:00Z", result_payload: payload, analysis_requests: request("owner") },
    { id: "other-user", user_id: "other", is_simulated: false, created_at: "2099-01-01T00:00:00Z", result_payload: { ciphertext: "must-not-decrypt" }, analysis_requests: request("other") },
    { id: "other-request", user_id: "owner", is_simulated: false, created_at: "2098-01-01T00:00:00Z", result_payload: { ciphertext: "must-not-decrypt" }, analysis_requests: request("other") },
    { id: "pending", user_id: "owner", is_simulated: false, created_at: "2097-01-01T00:00:00Z", result_payload: payload, analysis_requests: request("owner", "queued") },
    { id: "deleted", user_id: "owner", is_simulated: false, created_at: "2096-01-01T00:00:00Z", result_payload: payload, analysis_requests: request("owner", "completed", "2026-01-01") },
    { id: "simulated", user_id: "owner", is_simulated: true, created_at: "2095-01-01T00:00:00Z", result_payload: payload, analysis_requests: request("owner") },
  ];
  const queries: Array<{ table: string; filters: Array<[string, string, unknown]> }> = [];
  function query(table: string) {
    const item = { table, filters: [] as Array<[string, string, unknown]> }; queries.push(item);
    let ascending = true, max = Infinity;
    const q = {
      select: vi.fn().mockImplementation((columns: string) => {
        // The job table has created_at; transition time lives in its projection.
        if (table === "analysis_requests") expect(columns.split(",")).not.toContain("updated_at");
        return q;
      }),
      eq(k: string, v: unknown) { item.filters.push(["eq", k, v]); return q; },
      is(k: string, v: unknown) { item.filters.push(["eq", k, v]); return q; },
      not(k: string, _op: string, v: unknown) { item.filters.push(["not", k, v]); return q; },
      gte(k: string, v: unknown) { item.filters.push(["gte", k, v]); return q; },
      lte(k: string, v: unknown) { item.filters.push(["lte", k, v]); return q; },
      order(_k: string, opts: { ascending: boolean }) { ascending = opts.ascending; return q; },
      limit(n: number) { max = n; return q; },
      maybeSingle: async () => ({ data: table === "analysis_requests" ? { id: "latest-job", status: "queued", created_at: "2026-10-30T00:00:00Z" } : table === "analysis_status_projection" ? { updated_at: "2026-10-31T00:00:00Z" } : null, error: null }),
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        const data = rows.filter(row => item.filters.every(([op, k, v]) => {
          const actual = k.split(".").reduce((a: unknown, part) => (a as Record<string, unknown>)?.[part], row);
          return op === "eq" ? actual === v : op === "not" ? actual !== v : op === "gte" ? String(actual) >= String(v) : String(actual) <= String(v);
        })).sort((a, b) => (ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at)).slice(0, max);
        return Promise.resolve({ data, count, error: failure ? { message: "fictional failure" } : null }).then(resolve, reject);
      },
    };
    return q;
  }
  const service = Object.assign(Object.create(JournalService.prototype), {
    database: { schema: () => ({ from: query }) }, encryption,
    runtime: { mode: "disabled", developmentUserIds: new Set(), timeoutMs: 1000 },
  }) as JournalService;
  return { service, queries };
}
describe("Dashboard history query boundaries", () => {
  it("selects an older completed result for Dashboard outside chart range and excludes unauthorized/deleted/pending/synthetic rows", async () => {
    const { service, queries } = harness();
    const data = await service.dashboardInsights("owner", { range: "7d" }, true);
    expect(data.latestResultId).toBe("old-real");
    expect(data.latest).toEqual(result);
    expect(data.latestAnalyzedAt).toBe("2000-01-01T00:00:00Z");
    expect(data.emotionTrend).toEqual([]);
    expect(data.latestRequest).toEqual({ status: "queued", updatedAt: "2026-10-31T00:00:00Z" });
    expect(data.processorAvailable).toBe(false);
    expect(queries.find(q => q.table === "analysis_status_projection")?.filters).toEqual([
      ["eq", "job_id", "latest-job"], ["eq", "user_id", "owner"],
    ]);
    for (const q of queries.filter(q => q.table === "analysis_results")) expect(q.filters).toEqual(expect.arrayContaining([
      ["eq", "user_id", "owner"], ["eq", "analysis_requests.user_id", "owner"], ["eq", "analysis_requests.status", "completed"],
      ["eq", "analysis_requests.deleted_at", null], ["eq", "is_simulated", false],
    ]));
  });
  it("keeps Insights results within the selected custom dates", async () => {
    const { service } = harness();
    const data = await service.dashboardInsights("owner", { range: "custom", from: "1999-12-31", to: "2000-01-02" });
    expect(data.latestResultId).toBe("old-real"); expect(data.period.analyzedReflectionCount).toBe(1);
    expect(data.emotionTrend[0].date).toBe("2000-01-01");
  });
  it("reports a bounded history window instead of hiding missing older records", async () => {
    const data = await harness(false, 1001).service.dashboardInsights("owner", { range: "custom", from: "1999-12-31", to: "2000-01-02" });
    expect(data.period.analyzedReflectionCount).toBe(1001);
    expect(data.period.historyTruncated).toBe(true);
  });
  it("fails closed on query errors rather than fabricating an empty success", async () => {
    await expect(harness(true).service.dashboardInsights("owner")).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });
});


it("keeps unavailable native screening partial in completed job progress", async () => {
  const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
  const native = journalAnalysisV3ResultSchema.parse({ ...partial, journalScreening: {
    status: "unavailable", experimental: true, inferenceVersion: "journal-nullable-v1",
    items: null, coverage: 0, subtotal: null, total: null,
  } });
  const row = { user_id: "owner", journal_id: "journal", job_id: "job", status: "completed", progress: 100,
    facial_status: "not_requested", updated_at: "2026-11-01T00:00:00Z" };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
  const service = Object.assign(Object.create(JournalService.prototype), {
    encryption, database: { schema: () => ({ from: () => query }) },
    latestAnalysis: async () => ({ result_payload: { ciphertext: sealAnalysisResult(native, encryption).encryptedPayload } }),
  }) as JournalService;
  const progress = await service.getAnalysisStatus("owner", "job");
  expect(progress.checks.find(c => c.id === "phq8")).toMatchObject({ state: "partial", detail: expect.stringContaining("unavailable") });
  expect(progress.checks.find(c => c.id === "emotion")?.state).toBe("complete");
});
