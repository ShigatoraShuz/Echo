/** Browser uses a synthetic WAV microphone and fake inference; never opens hardware. */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createServer as viteServer } from "vite";
import { chromium } from "@playwright/test";
import { createApp } from "../src/app.js";
import { RealtimeTalkHub } from "../src/features/experience/realtime-talk.js";
import { ExperienceService } from "../src/features/experience/experience.service.js";
import { LocalBuddyStore } from "../src/infrastructure/analysis/local-buddy-store.js";

const root = fileURLToPath(new URL("../../../", import.meta.url)),
  require = createRequire(import.meta.url);
const base = root + "runtime-cache/talk-browser/";
await mkdir(base, { recursive: true });
const dir = await mkdtemp(base + "run-");
const fixture = await readFile(root + "runtime-cache/talk-fixtures/eng.wav");
// WAV fixture is PCM16 mono16k; retain its audio payload and add silence around it.
const original = fixture.subarray(fixture.indexOf(Buffer.from("data")) + 8);
const input = Buffer.concat([Buffer.alloc(64000), original, Buffer.alloc(192000)]);
const header = Buffer.alloc(44);
header.write("RIFF");
header.writeUInt32LE(36 + input.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(16000, 24);
header.writeUInt32LE(32000, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(input.length, 40);
const wavPath = dir + "/microphone.wav";
await writeFile(wavPath, Buffer.concat([header, input]));
const user = randomUUID(),
  token =
    "e30." +
    Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") +
    ".synthetic";
const output = Buffer.concat(Array.from({ length: 6 }, () => original));
const tasks: string[] = [];
const core: any = {
  talk: async (p: any) => {
    tasks.push(p.task);
    if (p.task === "warm") return { ready: true };
    if (p.task === "transcribe") return { text: "Synthetic browser microphone turn" };
    if (p.task === "chat")
      return { reply: "We can take one small step today.", supportRequired: false, model: { version: "test" } };
    if (p.task === "speak") return { audio: output.toString("base64"), sampleRate: 16000, model: { version: "test" } };
    return {};
  },
};
const service: any = new ExperienceService(
  {} as any,
  {} as any,
  {} as any,
  undefined,
  undefined,
  core,
  new LocalBuddyStore(dir),
);
service.historyEnabled = async () => false;
const verifier = { getUser: async (t: string) => (t === token ? { id: user, emailVerified: true } : null) },
  verification: any = { assertAiAccess: async () => {} };
const hub = new RealtimeTalkHub(service, core, verifier, verification, new Set(), {
  decide: async () => ({ decision: "ACCESS_GRANTED" }),
} as any);
service.realtime = hub;
const app = createApp({
  allowedOrigin: "http://127.0.0.1:3197",
  v1: { experience: { service, verifier, verificationService: verification } },
});
const server = app.listen(0, "127.0.0.1");
hub.attach(server);
await once(server, "listening");
const api = "http://127.0.0.1:" + (server.address() as any).port + "/api/v1";
// The test origin is explicitly allowlisted without changing production origin checks.
(hub as any).origins.add("http://127.0.0.1:3197");
await writeFile(dir + "/env.ts", `export const env={apiBaseUrl:${JSON.stringify(api)}};`);
await writeFile(
  dir + "/auth.ts",
  `export const supabaseAuthTokenProvider={getAccessToken:async()=>${JSON.stringify(token)}};`,
);
await writeFile(dir + "/index.html", '<div id="root"></div><script type="module" src="/main.tsx"></script>');
await writeFile(
  dir + "/main.tsx",
  `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useRealtimeTalk} from '@talk-hook';function App(){const [messages,setMessages]=useState([]),[deliveries,setDeliveries]=useState([]);const talk=useRealtimeTalk({conversationId:null,getTemporarySessionId:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',onMessage:m=>setMessages(x=>[...x,m]),onDelivery:(id,interrupted)=>setDeliveries(x=>[...x,interrupted?"interrupted":"played"])});return <><button onClick={()=>void talk.start()}>Start Talk</button><button onClick={talk.stop}>Stop Talk</button><button onClick={talk.interrupt}>Interrupt Buddy</button><div id="state">{talk.state}</div><div id="error">{talk.error}</div><div id="deliveries">{deliveries.join(",")}</div><div id="messages">{messages.map(m=><p key={m.id}>{m.content}</p>)}</div></>}createRoot(document.getElementById('root')).render(<App/>);`,
);
const vite = await viteServer({
  configFile: false,
  root: dir,
  publicDir: root + "Echo/frontend/public",
  server: { host: "127.0.0.1", port: 3197, strictPort: true, fs: { allow: [root + "Echo", dir] } },
  resolve: {
    alias: [
      { find: "@talk-hook", replacement: root + "Echo/frontend/src/features/buddy/view-model/use-realtime-talk.ts" },
      { find: "@/infrastructure/api/supabase-auth-token-provider", replacement: dir + "/auth.ts" },
      { find: "@/config/environment", replacement: dir + "/env.ts" },
      { find: /^react$/, replacement: require.resolve("react") },
      { find: "react/jsx-dev-runtime", replacement: require.resolve("react/jsx-dev-runtime") },
      { find: "react/jsx-runtime", replacement: require.resolve("react/jsx-runtime") },
      { find: "react-dom/client", replacement: require.resolve("react-dom/client") },
    ],
  },
  define: { "process.env.NEXT_PUBLIC_REALTIME_TALK": JSON.stringify("true") },
});
let browser: any;
const errors: string[] = [];
try {
  await vite.listen();
  browser = await chromium.launch({
    channel: process.env.ECHO_TEST_BROWSER_CHANNEL ?? "msedge",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-file-for-fake-audio-capture=" + wavPath,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e: any) => errors.push(e.message));
  page.on("console", (message: any) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    const target = window as any;
    target.__stoppedTracks = 0;
    target.__closedContexts = 0;
    target.__audioStops = [];
    target.__cancels = [];
    const audioStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args) {
      target.__audioStops.push(performance.now());
      return audioStop.apply(this, args);
    };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (typeof data === "string") {
        try {
          if (JSON.parse(data).type === "cancel") target.__cancels.push(performance.now());
        } catch {}
      }
      return send.call(this, data);
    };
    const stop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function () {
      target.__stoppedTracks++;
      return stop.call(this);
    };
    const close = AudioContext.prototype.close;
    AudioContext.prototype.close = function () {
      target.__closedContexts++;
      return close.call(this);
    };
  });
  await page.goto("http://127.0.0.1:3197");
  await page.getByRole("button", { name: "Start Talk", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#messages")?.textContent?.includes("We can take one small step today."),
    {},
    { timeout: 45000 },
  );
  assert.ok(tasks.includes("transcribe") && tasks.includes("chat") && tasks.includes("speak"));
  await page.waitForFunction(
    () => document.querySelector("#deliveries")?.textContent?.includes("interrupted"),
    {},
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Stop Talk", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#state")?.textContent === "idle");
  assert.equal((await page.locator("#error").textContent()) ?? "", "");
  assert.ok(await page.evaluate(() => (window as any).__stoppedTracks > 0 && (window as any).__closedContexts > 0));
  const stoppedText = await page.locator("#messages").textContent();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("#messages").textContent(), stoppedText);
  const interruptionTiming = await page.evaluate(() => {
    const w = window as any;
    const cancel = w.__cancels[0];
    return { cancelAt: cancel, lastAudioStopBeforeCancel: w.__audioStops.filter((t: number) => t <= cancel).at(-1) };
  });
  assert.ok(interruptionTiming.cancelAt - interruptionTiming.lastAudioStopBeforeCancel < 500);
  const cases = {
    bargeIn: true,
    stopCleanup: true,
    microphoneDenial: false,
    missingVad: false,
    blockedPlayback: false,
    silence: false,
    hiddenTabCleanup: false,
    congestionCleanup: false,
  };
  async function unavailable(setup: (p: any) => Promise<void>, expected: RegExp) {
    const p = await browser.newPage();
    await setup(p);
    await p.goto("http://127.0.0.1:3197");
    await p.getByRole("button", { name: "Start Talk", exact: true }).click();
    await p.waitForFunction(() => document.querySelector("#state")?.textContent === "unavailable");
    assert.match((await p.locator("#error").textContent()) ?? "", expected);
    await p.close();
    await new Promise((r) => setTimeout(r, 100));
  }
  await unavailable(async (p) => {
    await p.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Synthetic microphone denied", "NotAllowedError");
      };
    });
  }, /denied/);
  cases.microphoneDenial = true;
  await unavailable(async (p) => {
    await p.route("**/vendor/buddy-vad/silero.onnx", (route: any) =>
      route.fulfill({ status: 404, body: "Synthetic missing asset" }),
    );
  }, /fetch|load|404|model/i);
  cases.missingVad = true;
  await unavailable(async (p) => {
    await p.addInitScript(() => {
      AudioContext.prototype.resume = async () => {
        throw new DOMException("Synthetic playback blocked", "NotAllowedError");
      };
    });
  }, /blocked/);
  cases.blockedPlayback = true;
  const silent = await browser.newPage();
  await silent.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext({ sampleRate: 16000 }),
        destination = ctx.createMediaStreamDestination(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(destination);
      osc.start();
      await ctx.resume();
      (window as any).__silent = { ctx, stream: destination.stream };
      return destination.stream;
    };
  });
  await silent.goto("http://127.0.0.1:3197");
  await silent.getByRole("button", { name: "Start Talk", exact: true }).click();
  await silent.waitForFunction(() => document.querySelector("#state")?.textContent === "listening");
  const before = tasks.filter((t) => t === "transcribe").length;
  await silent.waitForTimeout(3000);
  assert.equal(await silent.locator("#messages").textContent(), "");
  assert.equal(tasks.filter((t) => t === "transcribe").length, before);
  cases.silence = true;
  await silent.evaluate(() => {
    Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await silent.waitForFunction(() => document.querySelector("#state")?.textContent === "idle");
  assert.ok(
    await silent.evaluate(() =>
      (window as any).__silent.stream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  );
  cases.hiddenTabCleanup = true;
  await silent.evaluate(() => (window as any).__silent.ctx.close());
  await silent.evaluate(() => Object.defineProperty(document, "hidden", { get: () => false, configurable: true }));
  await silent.waitForTimeout(100);
  await silent.getByRole("button", { name: "Start Talk", exact: true }).click();
  await silent.waitForFunction(() => document.querySelector("#state")?.textContent === "listening");
  await silent.evaluate(() =>
    Object.defineProperty(WebSocket.prototype, "bufferedAmount", { get: () => 256 * 1024, configurable: true }),
  );
  await silent.getByRole("button", { name: "Interrupt Buddy", exact: true }).click();
  await silent.waitForFunction(() => document.querySelector("#state")?.textContent === "unavailable");
  assert.match((await silent.locator("#error").textContent()) ?? "", /stalled/);
  assert.ok(
    await silent.evaluate(() =>
      (window as any).__silent.stream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  );
  cases.congestionCleanup = true;
  await silent.evaluate(() => (window as any).__silent.ctx.close());
  await silent.close();
  await writeFile(
    base + "result.json",
    JSON.stringify(
      {
        passed: true,
        tasks,
        errors,
        interruptionTiming,
        cases,
        scope:
          "real browser AudioWorklet + local Silero/ONNX VAD + fake WAV input + real Express/WebSocket; model inference stubbed; no microphone hardware",
      },
      null,
      2,
    ),
    "utf8",
  );
  console.info(
    "PASS synthetic browser AudioWorklet/VAD -> authenticated WebSocket -> progressive playback -> Stop cleanup",
  );
} finally {
  await browser?.close();
  await vite.close();
  await hub.shutdown();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (errors.length) console.info("BROWSER ERRORS", errors);
}
