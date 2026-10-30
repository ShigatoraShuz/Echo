/** Read-only local verification of the actual browser-created fixture jobs. No payload/secret export. */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LOCAL_API, FIXTURE_TAG, localEnvironment, localFetch, assertFixtureUser } from "./lib/professional-local-target.mts";
import { modelEvidenceDirectory } from "./lib/model-evidence.mts";

const local = localEnvironment(process.cwd());
const students = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (students.tag !== "echo-student-consultation-v1" || students.fingerprint !== local.fingerprint) throw new Error("Fixture target mismatch");
const evidence = modelEvidenceDirectory("artifacts/model-integration/port3000-runtime-20261030");
const browserFolder = process.argv.includes("--final") ? "browser-final" : "browser";
const journeys = JSON.parse(readFileSync(`${evidence}/${browserFolder}/browser-results.json`, "utf8")).journeys;
if (existsSync(`${evidence}/switch/results.json`)) {
  const switched = JSON.parse(readFileSync(`${evidence}/switch/results.json`, "utf8"));
  journeys.push({ ...switched, studentId: students.accounts[0].id, expectedIdentity: switched.identity });
}
if (existsSync(`${evidence}/recovery-results.json`)) {
  const recovered = JSON.parse(readFileSync(`${evidence}/recovery-results.json`, "utf8")).recover;
  if (recovered && !journeys.some((journey: { jobId: string }) => journey.jobId === recovered.jobId)) journeys.push({ ...recovered, studentId: students.accounts[0].id });
}
const db = createClient(LOCAL_API, local.serviceKey, { auth: { persistSession: false }, global: { fetch: localFetch } });
const jobs = [];
for (const journey of journeys) {
  const actor = students.accounts.find((account: { id: string }) => account.id === journey.studentId);
  if (!actor || !journey.jobId) throw new Error("Journey actor missing");
  const user = await db.auth.admin.getUserById(actor.id);
  if (user.error || !user.data.user) throw new Error("Local actor unavailable");
  assertFixtureUser(user.data.user, actor.email);
  if (user.data.user.app_metadata.fixture !== FIXTURE_TAG || user.data.user.app_metadata.consultation_demo !== true) throw new Error("Actor is not a fictional consultation fixture");
  const [job, receipts, result] = await Promise.all([
    db.schema("ai_analysis").from("analysis_requests").select("id,journal_id,status,attempt_count,processing_mode,created_at,started_at,completed_at,failure_code").eq("id", journey.jobId).eq("user_id", actor.id).single(),
    db.schema("ai_analysis").from("callback_receipts").select("callback_type,worker_id,outcome_status,created_at").eq("job_id", journey.jobId).order("created_at"),
    db.schema("ai_analysis").from("analysis_results").select("id,result_payload,is_simulated").eq("analysis_request_id", journey.jobId).single(),
  ]);
  if (job.error || receipts.error || result.error || job.data.status !== "completed" || job.data.journal_id !== journey.journalId || result.data.is_simulated !== false || Object.keys(result.data.result_payload).join(",") !== "ciphertext") throw new Error("Completed real encrypted job proof failed");
  if (!receipts.data.some(row => row.callback_type === "final_result" && row.worker_id === "echo-http-engineering-v1")) throw new Error("Trusted final-result callback missing");
  // Read historical attribution through the owner's actual authenticated API.
  const auth = createClient(LOCAL_API, local.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } });
  const login = await auth.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (login.error || !login.data.session) throw new Error("Owner sign-in failed.");
  const response = await fetch(`http://127.0.0.1:4300/api/v1/journals/${journey.journalId}/analyses`, {
    headers: { Authorization: `Bearer ${login.data.session.access_token}` }, redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Owner historical result unavailable.");
  const saved = (await response.json()).data.result.stages.cbt;
  const identity = `${saved.modelId}@${saved.modelVersion}`;
  const expected = journey.expectedIdentity ?? `${journey.stages.cbt.modelId}@${journey.stages.cbt.modelVersion}`;
  if (identity !== expected) throw new Error("Historical model attribution changed after model switching.");
  await auth.auth.signOut({ scope: "local" });
  jobs.push({ ...job.data, resultId: result.data.id, identity, historicalAttributionPreserved: true, encryptedResult: true, isSimulated: false, receipts: receipts.data });
}
const worker = await db.schema("ai_analysis").from("worker_health").select("worker_id,accepting_jobs,model_status,model_version,last_heartbeat_at").eq("worker_id", "echo-http-engineering-v1").single();
if (worker.error || !worker.data.accepting_jobs || Date.now() - Date.parse(worker.data.last_heartbeat_at) > 30000) throw new Error("Fresh worker heartbeat missing");
const state = JSON.parse(readFileSync("backend/tmp/development-runtime/runtime.json", "utf8"));
const report = { target: LOCAL_API, fingerprint: local.fingerprint, supervisor: state, worker: worker.data, jobs };
writeFileSync(`${evidence}/worker-callback-evidence.json`, JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ completedRealEncryptedJobs: jobs.length, trustedFinalCallbacks: true, workerFresh: true, fingerprint: local.fingerprint }) + "\n");
