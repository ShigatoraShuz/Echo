/** Synthetic only. Real copied models over FastAPI + Express + authenticated WebSocket. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createApp } from "../src/app.js";
import { RealtimeTalkHub, speechPhrases } from "../src/features/experience/realtime-talk.js";
import { ExperienceService } from "../src/features/experience/experience.service.js";
import { CoreClient } from "../src/infrastructure/analysis/core-client.js";
import { LocalBuddyStore } from "../src/infrastructure/analysis/local-buddy-store.js";

if (process.env.ECHO_BENCHMARK_TALK !== "true") throw Error("Explicit benchmark flag required");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = process.env.BUDDY_TALK_RUN ?? "realtime-benchmark";
if (!/^[a-z0-9-]+$/.test(run)) throw Error("Invalid benchmark name");
const output = root + "runtime-cache/" + run + "/";
await mkdir(output, { recursive: true });
const probe = net.createServer().listen(0, "127.0.0.1");
await once(probe, "listening");
const corePort = (probe.address() as net.AddressInfo).port;
await new Promise<void>((r) => probe.close(() => r()));
const coreUrl = `http://127.0.0.1:${corePort}`,
  internalToken = "synthetic-talk-internal-token-at-least-32-characters";
const child = spawn(
  process.env.ECHO_PYTHON ?? root + "../PROJECTS/Thesis2/Thesis2_VENV/python.exe",
  ["-B", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(corePort), "--workers", "1"],
  {
    cwd: root + "Echo/ai-service",
    env: {
      ...process.env,
      ECHO_ISOLATED_TEST: "true",
      CORE_MODELS_ENABLED: "true",
      REALTIME_TALK_ENABLED: "true",
      WORKER_ENABLED: "false",
      AI_SERVICE_TOKEN: internalToken,
      MODELS_ROOT: root + "models",
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      HF_HOME: root + "runtime-cache/speech-hf",
      RATE_LIMIT_PER_MINUTE: "600",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
const logs: string[] = [];
child.stdout.on("data", (v) => logs.push(String(v)));
child.stderr.on("data", (v) => logs.push(String(v)));
const core = new CoreClient(coreUrl, internalToken);
const cold = Date.now();
let hub: RealtimeTalkHub | undefined, server: any, ws: WebSocket | undefined;
const records: any[] = [];
const parity: any[] = [];
let readyMetadata: any;
let coldStartMs: number;
const samples: { language: string; text: string }[] = [
  { language: "eng", text: "I had a calm day. What is one small task I can plan for tomorrow?" },
  { language: "tgl", text: "Masaya ang araw ko ngayon. Ano ang isang magandang gawain para bukas?" },
  { language: "taglish", text: "I enjoyed my lunch today. Masarap ang pagkain." },
];
try {
  const deadline = Date.now() + 600000;
  while (!(await core.ready())) {
    if (child.exitCode !== null || Date.now() > deadline)
      throw Error("Core startup failed: " + logs.join("").slice(-1500));
    await new Promise((r) => setTimeout(r, 500));
  }
  const gpuChecks = [];
  for (const sample of samples) {
    const response = await fetch(coreUrl + "/v2/classify", {
      method: "POST",
      headers: { Authorization: "Bearer " + internalToken, "Content-Type": "application/json" },
      body: JSON.stringify({ text: sample.text }),
    });
    assert.equal(response.status, 200);
    gpuChecks.push(await response.json());
  }
  const dataDir = await mkdtemp(output + "data-");
  const store = new LocalBuddyStore(dataDir),
    user = randomUUID();
  const token =
    "e30." +
    Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 })).toString("base64url") +
    ".synthetic";
  const database = new Proxy(
    {},
    {
      get() {
        throw Error("Cloud data access forbidden in synthetic Talk benchmark");
      },
    },
  );
  const service: any = new ExperienceService(database as any, {} as any, {} as any, undefined, undefined, core, store);
  service.historyEnabled = async () => true;
  const verifier = { getUser: async (value: string) => (value === token ? { id: user, emailVerified: true } : null) };
  const verification: any = { assertAiAccess: async () => {} };
  const access: any = { decide: async () => ({ decision: "ACCESS_GRANTED" }) };
  hub = new RealtimeTalkHub(service, core, verifier, verification, new Set(["http://localhost:3000"]), access);
  service.realtime = hub;
  const app = createApp({ v1: { experience: { service, verifier, verificationService: verification } } });
  server = app.listen(0, "127.0.0.1");
  hub.attach(server);
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const sessionRes = await fetch(base + "/buddy/voice/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({ temporarySessionId: randomUUID() }),
  });
  assert.equal(sessionRes.status, 201);
  const session = (await sessionRes.json()).data;
  ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/api/v1/buddy/voice/stream`, {
    origin: "http://localhost:3000",
  });
  let events: any[] = [];
  let fullPlayback = false;
  ws.on("error", () => {});
  ws.on("message", (raw) => {
    const e = JSON.parse(raw.toString());
    e.receivedAt = Date.now();
    events.push(e);
    if (fullPlayback && e.type === "audio" && ws?.readyState === WebSocket.OPEN)
      ws.send(
        JSON.stringify({
          type: "played",
          generation: e.generation,
          turnId: e.turnId,
          sequence: e.sequence,
          samples: Buffer.from(e.audio, "base64").length / 2,
        }),
      );
  });
  await once(ws, "open");
  ws.send(JSON.stringify({ type: "authenticate", ticket: session.ticket }));
  const wait = async (type: string, generation?: number, timeout = 150000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = events.find((e) => e.type === type && (generation === undefined || e.generation === generation));
      if (value) return value;
      const error = events.find(
        (e) => e.type === "error" || (e.type === "state" && ["unavailable", "auth_required"].includes(e.state)),
      );
      if (error) throw Error("Talk event " + JSON.stringify(error));
      if (ws!.readyState !== WebSocket.OPEN) throw Error("WebSocket closed");
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Timeout waiting for " + type);
  };
  readyMetadata = await wait("ready");
  coldStartMs = Date.now() - cold;
  const timer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }, 15000);
  try {
    const fixtures = new Map<string, Buffer>();
    for (const [index, sample] of samples.entries()) {
      const cpu = await core.talk({ task: "support_check", sessionId: session.sessionId, text: sample.text });
      const gpu = gpuChecks[index];
      const scores = "all_category_scores_relative_not_diagnoses";
      parity.push({
        language: sample.language,
        sameCategory: cpu.distress_category === gpu.distress_category,
        sameFlag: cpu.suicidal_language_flag === gpu.suicidal_language_flag,
        maxScoreDifference: Math.max(...Object.keys(gpu[scores]).map((k) => Math.abs(gpu[scores][k] - cpu[scores][k]))),
      });
      const chunks = [];
      for (const phrase of speechPhrases(sample.text)) {
        const spoken = await core.talk({ task: "speak", sessionId: session.sessionId, ...phrase });
        chunks.push(Buffer.from(spoken.audio, "base64"));
      }
      fixtures.set(sample.language, Buffer.concat(chunks));
    }
    let generation = 0;
    const count = Number(process.env.BUDDY_TALK_BENCHMARK_TURNS ?? 30);
    const counts = JSON.parse(process.env.BUDDY_TALK_COUNTS ?? "{}");
    turns: for (let repetition = 0; repetition < count; repetition++)
      for (const sample of samples) {
        if (repetition >= (counts[sample.language] ?? count)) continue;
        generation++;
        fullPlayback = repetition === 0;
        events = [];
        const turnId = randomUUID();
        ws.send(JSON.stringify({ type: "begin", turnId, generation }));
        const pcm = fixtures.get(sample.language)!;
        let sequence = 0;
        for (let offset = 0; offset < pcm.length; offset += 1024) {
          const part = pcm.subarray(offset, offset + 1024),
            frame = Buffer.alloc(part.length + 8);
          frame.writeUInt32LE(generation, 0);
          frame.writeUInt32LE(sequence++, 4);
          part.copy(frame, 8);
          ws.send(frame);
          await new Promise((r) => setTimeout(r, 20));
        }
        const speechEnd = Date.now();
        await new Promise((r) => setTimeout(r, 928));
        ws.send(JSON.stringify({ type: "finish", turnId, generation }));
        try {
          const audio = await wait("audio", generation);
          const reply = await wait("approved_reply", generation);
          const final = await wait("final_transcript", generation);
          const convo = store.get(user, reply.conversationId);
          const provenance = convo.provenance.findLast((x) => x.turnId === turnId);
          records.push({
            language: sample.language,
            syntheticText: sample.text,
            repetition,
            firstAudioMs: audio.receivedAt - speechEnd,
            transcriptionMs: final.receivedAt - speechEnd,
            approvedReplyMs: reply.receivedAt - speechEnd,
            supportRequired: reply.supportRequired,
            model: provenance?.model,
            quality: provenance?.quality,
            replyCharacters: reply.message.content.length,
            receivedAudioBytes: Buffer.from(audio.audio, "base64").length,
            metrics: await (
              await fetch(coreUrl + "/v2/runtime", { headers: { Authorization: "Bearer " + internalToken } })
            ).json(),
          });
          if (fullPlayback) {
            try {
              await wait("turn_end", generation);
              const reopened = new LocalBuddyStore(dataDir).get(user, reply.conversationId);
              assert.equal(reopened.messages.find((m) => m.id === reply.message.id)?.delivery?.state, "played");
              Object.assign(records.at(-1), {
                fullReplyCompleted: true,
                tts: reopened.provenance.findLast((x) => x.turnId === turnId)?.tts,
                totalAudioBytes: events
                  .filter((e) => e.type === "audio")
                  .reduce((a, e) => a + Buffer.from(e.audio, "base64").length, 0),
              });
            } catch (error) {
              records.at(-1).fullReplyError = String(error);
              ws.send(JSON.stringify({ type: "cancel", generation }));
            }
          } else {
            ws.send(JSON.stringify({ type: "cancel", generation }));
            await wait("delivery", generation);
          }
          await new Promise((r) => setTimeout(r, 100));
        } catch (error) {
          records.push({ language: sample.language, repetition, error: String(error) });
          if (ws.readyState !== WebSocket.OPEN) break turns;
          ws.send(JSON.stringify({ type: "cancel", generation }));
        }
        await writeFile(
          output + "results.json",
          JSON.stringify(
            {
              records,
              parity,
              readyMetadata,
              coldStartMs,
              scope:
                "synthetic PCM over Express/WebSocket, actual models, local JSON; audio playback simulated; no browser or microphone; auth/account checks use fixture identities; first repetition acknowledges complete speech; other turns interrupt after first audio; audio device not exercised",
            },
            null,
            2,
          ),
          "utf8",
        );
        console.info(
          "TURN",
          sample.language,
          repetition,
          records.at(-1).firstAudioMs,
          records.at(-1).supportRequired ? "support" : "cbt",
        );
      }
    const summary = Object.fromEntries(
      samples.map(({ language }) => {
        const rows = records.filter((x) => x.language === language),
          normal = rows
            .filter((x) => !x.error && !x.supportRequired)
            .map((x) => x.firstAudioMs)
            .sort((a, b) => a - b);
        return [
          language,
          {
            attempts: rows.length,
            failures: rows.filter((x) => x.error).length,
            supportResponses: rows.filter((x) => x.supportRequired).length,
            normalCbtReplies: normal.length,
            median: normal.length ? normal[Math.floor(normal.length * 0.5)] : null,
            p95: normal.length ? normal[Math.min(normal.length - 1, Math.ceil(normal.length * 0.95) - 1)] : null,
            latencyGate:
              rows.length >= 30 &&
              rows.every((x) => !x.error && !x.fullReplyError) &&
              normal.length >= 30 &&
              normal[Math.min(normal.length - 1, Math.ceil(normal.length * 0.95) - 1)] <= 10000,
          },
        ];
      }),
    );
    assert.ok(new LocalBuddyStore(dataDir).list(user).flatMap((c) => c.messages).length > 0);
    await writeFile(
      output + "results.json",
      JSON.stringify(
        {
          records,
          coldStartMs,
          summary,
          parity,
          readyMetadata,
          scope:
            "synthetic PCM over authenticated Express/WebSocket, actual models and local JSON; auth fixture, no Supabase requests; first repetition acknowledges complete speech; other turns interrupt after first audio; browser/hardware unverified",
        },
        null,
        2,
      ),
      "utf8",
    );
    console.info("SUMMARY", JSON.stringify(summary));
  } finally {
    clearInterval(timer);
  }
} finally {
  ws?.close();
  await hub?.shutdown();
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (child.exitCode === null) {
    child.kill();
    await once(child, "exit");
  }
  await writeFile(output + "server.log", logs.join(""), "utf8");
}
