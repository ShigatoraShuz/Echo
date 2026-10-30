import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { strict as assert } from "node:assert";
import { localEnvironment, localFetch, LOCAL_API, FIXTURE_TAG } from "./lib/professional-local-target.mts";

const mode = process.argv[2];
const label=process.argv[3]??mode;
if(!/^[a-z-]{1,40}$/.test(label??""))throw new Error("Invalid evidence label");
if (!["dedup", "offline"].includes(mode ?? "")) throw new Error("Use dedup or offline with the guarded local services");
const target = localEnvironment(process.cwd());
const fixture = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== target.fingerprint || !fixture.complete)
  throw new Error("Fixture mismatch");
const client = createClient(LOCAL_API, target.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: localFetch },
});
const logged = await client.auth.signInWithPassword({
  email: "client@professional.echo.test",
  password: fixture.accounts.client.password,
});
if (logged.error || !logged.data.session) throw new Error("Local fixture login failed");
const token = logged.data.session.access_token;
const api = async (path: string, method = "GET", body?: unknown, key?: string) => {
  const response = await fetch(`http://127.0.0.1:4300/api/v1${path}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};
try {
  const key = randomUUID(),
    input = {
      title: `SYNTHETIC ${mode} integration test ${Date.now()}`,
      body: "Fictional engineering text only; no participant or clinical data.",
      mood: "calm",
      analysisConsent: true,
    };
  localEnvironment(process.cwd());
  const start=performance.now();
  const created = await api("/journals", "POST", input, key);
  assert.equal(created.status, 202);
  const job = created.body.data;
  if (mode === "dedup") {
    const repeated = await api("/journals", "POST", input, key);
    assert.equal(repeated.status, 202);
    assert.equal(repeated.body.data.journalId, job.journalId);
    assert.equal(repeated.body.data.analysisJobId, job.analysisJobId);
  } else {
    const chat = await api("/buddy/messages", "POST", { content: "Fictional transport-failure test." });
    assert.equal(chat.status, 503);
    assert.equal(chat.body.error.code, "MODEL_UNAVAILABLE");
  }
  let status;
  for (let attempt = 0; attempt < 90; attempt++) {
    status = await api(`/analysis-jobs/${job.analysisJobId}/status`);
    if (["completed", "failed"].includes(status.body?.data?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(status?.body?.data?.status, mode === "dedup" ? "completed" : "failed");
  const database = createClient(LOCAL_API, target.serviceKey, {
    auth: { persistSession: false },
    global: { fetch: localFetch },
  });
  const requests = await database
    .schema("ai_analysis")
    .from("analysis_requests")
    .select("id,attempt_count,status")
    .eq("journal_id", job.journalId);
  assert.equal(requests.error, null);
  assert.equal(requests.data?.length, 1);
  const results = await database
    .schema("ai_analysis")
    .from("analysis_results")
    .select("id")
    .eq("analysis_request_id", job.analysisJobId);
  assert.equal(results.error, null);
  assert.equal(results.data?.length, mode === "dedup" ? 1 : 0);
  const ownJournal = await api(`/journals/${job.journalId}`);
  assert.equal(ownJournal.status, 200);
  const analysis=mode==="dedup" ? await api(`/journals/${job.journalId}/analyses`) : undefined;
  const report = {
    mode,
    passed: true,
    journalId: job.journalId,
    jobId: job.analysisJobId,
    requests: 1,
    results: results.data!.length,
    attempts: requests.data![0].attempt_count,
    status: status!.body.data.status,
    sourceJournalPreserved: true,
    saveToConfirmedPersistenceMs:Math.round(performance.now()-start),
    ...(analysis?.body?.data?.result?.stages ? {modelStages:Object.fromEntries(Object.entries(analysis.body.data.result.stages).map(([task,stage])=>{
      const value=stage as {modelId:string|null;modelVersion:string|null;status:string;durationMs:number};
      return [task,{modelId:value.modelId,modelVersion:value.modelVersion,status:value.status,durationMs:value.durationMs}];
    }))}:{}),
    ...(mode === "offline" ? { buddyUnavailable: 503 } : {}),
    target: "local Supabase 54321 / PostgreSQL 54322",
  };
  writeFileSync(`artifacts/model-integration/${label}-api-results.json`, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
} finally {
  await client.auth.signOut({ scope: "local" });
}
