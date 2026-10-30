/** Standard local Echo supervisor. Historical dev:consultation is an alias only. */
import concurrently from "concurrently";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { assertConsultationPortsAvailable, waitForConsultation } from "./lib/consultation-startup.mts";
import { LOCAL_API, localFetch } from "./lib/professional-local-target.mts";
import { developmentConfiguration } from "./lib/local-development.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (resolve(process.cwd()).toLowerCase() !== root.toLowerCase()) throw new Error("Run npm run dev from the Echo repository root.");
const python = resolve("ai-service/.venv/Scripts/python.exe");
// Rehash selected artifacts before launching any inference service. No catalog cache trust.
const checked = execFileSync(python, ["-m", "app.model.management", "prepare"], {
  cwd: root, env: { ...process.env, PYTHONPATH: resolve("ai-service"), HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
  encoding: "utf8", timeout: 180_000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
const prepared = JSON.parse(checked);
const config = developmentConfiguration(root);
const local = config.local;
const selected = prepared.tasks as Record<string, string>;
const effective: Record<string, string> = { ...config.tasks, ...(config.researchDiagnostic ? { researchDiagnostic: config.researchDiagnostic } : {}) };
if (Object.keys(selected).length !== Object.keys(effective).length || Object.entries(selected).some(([task, identity]) => effective[task] !== identity))
  throw new Error("Selection changed during startup validation. Retry npm run dev after activation completes.");
if (process.argv.includes("--check")) {
  process.stdout.write(JSON.stringify({ localTarget: LOCAL_API, fingerprint: local.fingerprint, frontend: "http://127.0.0.1:3000", models: selected, checkpointValidation: "PASS", noProcessesStarted: true }) + "\n");
  process.exit(0);
}
await assertConsultationPortsAvailable();

const directory = resolve("backend/tmp/development-runtime");
mkdirSync(directory, { recursive: true });
const startedAt = new Date().toISOString();
const logPath = resolve(directory, `runtime-${Date.now()}.log`);
const log = createWriteStream(logPath, { flags: "wx" });
let logBytes = 0;
const output = new Writable({ write(chunk, _encoding, done) {
  process.stdout.write(chunk);
  logBytes += Buffer.byteLength(chunk);
  if (logBytes <= 20_000_000) log.write(chunk);
  done();
} });
const group = concurrently(["ai", "backend", "frontend"].map(name => ({ name,
  command: `node --import tsx backend/scripts/model-local-app.mts ${name} development --live`, cwd: root,
})), { cwd: root, prefix: "[{name}]", outputStream: output, killOthersOn: [], restartTries: 1, restartDelay: 15000 });
const state = { startedAt, supervisorPid: process.pid, state: "starting", lastCheckedAt: 0, frontend: "http://127.0.0.1:3000", backend: "http://127.0.0.1:4300", fastApi: "http://127.0.0.1:8100", localSupabase: LOCAL_API, fingerprint: local.fingerprint, models: selected, logPath, services: group.commands.map(c => ({ name: c.name, pid: c.pid })) };
const save = () => {
  state.services = group.commands.map(c => ({ name: c.name, pid: c.pid }));
  writeFileSync(resolve(directory, "runtime.json"), JSON.stringify(state, null, 2));
};
save();
for (const command of group.commands) {
  // concurrently emits state=started before assigning the replacement PID.
  command.timer.subscribe(save);
  command.stateChange.subscribe(() => queueMicrotask(save));
}
let ended = false;
const ending = group.result.then(() => { ended = true; }, () => { ended = true; process.exitCode = 1; });
// Filesystem-only control, handled by this owning supervisor. No PID-based external kill.
const stopTimer = setInterval(() => {
  const requestPath = resolve(directory, "stop-request.json");
  if (!existsSync(requestPath)) return;
  try {
    const request = JSON.parse(readFileSync(requestPath, "utf8"));
    if (request.supervisorPid === process.pid && request.startedAt === startedAt) process.emit("SIGINT", "SIGINT");
  } catch { /* Incomplete writes are retried; never act on malformed requests. */ }
}, 1000);
stopTimer.unref();
const secret = config.secret("model-service-v1");
const database = createClient(LOCAL_API, local.serviceKey, { auth: { persistSession: false }, global: { fetch: localFetch } });
async function health() {
  const [front, backend, ai, worker] = await Promise.all([
    fetch(state.frontend + "/login", { signal: AbortSignal.timeout(5000), redirect: "error" }).then(r => r.ok).catch(() => false),
    fetch(state.backend + "/api/v1/verification", { signal: AbortSignal.timeout(3000), redirect: "error" }).then(r => r.status === 401).catch(() => false),
    fetch(state.fastApi + "/engineering/v2/models", { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(3000), redirect: "error" }).then(async r => { if (!r.ok) return false; const v = await r.json(); return v.executionMode === "real" && Object.entries(config.tasks).every(([task, identity]) => v.models[task]?.status === "validated_not_loaded" && `${v.models[task].modelId}@${v.models[task].modelVersion}` === identity); }).catch(() => false),
    database.schema("ai_analysis").from("worker_health").select("accepting_jobs,last_heartbeat_at,model_status").eq("worker_id", "echo-http-engineering-v1").maybeSingle(),
  ]);
  return front && backend && ai && !worker.error && worker.data?.accepting_jobs === true && worker.data.model_status === "engineering_http_bridge" && Date.parse(worker.data.last_heartbeat_at) >= Date.parse(startedAt) && Date.now() - Date.parse(worker.data.last_heartbeat_at) < 30000;
}
try {
  await waitForConsultation(async () => { if (ended) throw new Error("Local services exited during startup."); return health(); });
  state.state = "ready"; state.lastCheckedAt = Date.now(); save();
  process.stdout.write(`\nEcho development READY at ${state.frontend}\nLocal Auth/database only. Real models selected; Journal worker runs inside Express.\nKeep this terminal running. Ctrl+C stops owned app services, preserving local Supabase/data.\nLog: ${logPath}\n`);
  let checking = false;
  const timer = setInterval(() => {
    if (checking) return;
    checking = true;
    void health().catch(() => false).then(ready => { const next = ready ? "ready" : "degraded"; if (state.state !== next) process.stdout.write(`Development ${next}: service failures remain visible; no automatic guided/cloud fallback.\n`); state.state = next; state.lastCheckedAt = Date.now(); save(); }).finally(() => { checking = false; });
  }, 15000);
  timer.unref();
  await ending;
  clearInterval(timer);
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : "Local startup failed.") + "\n");
  for (const command of group.commands) if (command.state === "started") command.kill();
  await ending; process.exitCode = 1;
} finally { clearInterval(stopTimer); state.state = "stopped"; save(); log.end(); }
