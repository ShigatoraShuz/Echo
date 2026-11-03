/** Real browser + actual Buddy hook/transport; synthetic audio and stubbed models only. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createServer as createVite } from "vite";

import { RealtimeTalkHub } from "../src/features/experience/realtime-talk.js";
import { ExperienceService } from "../src/features/experience/experience.service.js";
import { LocalBuddyStore } from "../src/infrastructure/analysis/local-buddy-store.js";

const root = fileURLToPath(new URL("../../", import.meta.url)).replace(/\\/g, "/");
const frontendRequire = createRequire(root + "frontend/package.json");
const { default: react } = await import(pathToFileURL(frontendRequire.resolve("@vitejs/plugin-react")).href);
const { chromium } = await import(pathToFileURL(frontendRequire.resolve("@playwright/test")).href);
const dir = root + "tmp/buddy-browser";
await mkdir(dir, { recursive: true });
const user = randomUUID(),
  token = "e30." + Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString("base64url") + ".synthetic";
const answer =
  "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence. Seventh sentence.";
const tasks: string[] = [],
  schedules: number[] = [];
let failNextSpeech = false;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const core: any = {
  talk: async (p: any, signal?: AbortSignal) => {
    tasks.push(p.task);
    if (signal?.aborted) throw Error("cancelled");
    if (p.task === "warm")
      return { ready: true, freeGpuBytes: 8 * 1024 ** 3, speech: { model: { whisperDevice: "cpu" } } };
    if (p.task === "transcribe") return { text: "A synthetic conversation turn." };
    if (p.task === "chat") {
      await pause(300);
      return { reply: answer, supportRequired: false };
    }
    if (p.task === "prepare") {
      const parts = p.text.match(/[^.!?]+[.!?]*\s*/g);
      return {
        preparedText: p.text,
        groups: [parts.slice(0, 1), parts.slice(1, 2), parts.slice(2, 5), parts.slice(5)],
      };
    }
    if (p.task === "speak") {
      schedules.push(p.texts.length);
      await pause(350);
      if (signal?.aborted) throw Error("cancelled");
      if (failNextSpeech) {
        failNextSpeech = false;
        throw Error("Synthetic speech failure");
      }
      const pcm = Buffer.alloc((48000 * 4) / 4);
      for (let frame = 0; frame < pcm.length / 4; frame++) {
        const value = Math.round(4000 * Math.sin((frame * 2 * Math.PI * 220) / 48000));
        pcm.writeInt16LE(value, frame * 4);
        pcm.writeInt16LE(value, frame * 4 + 2);
      }
      return {
        segments: p.texts.map((text: string) => ({
          text,
          audio: pcm.toString("base64"),
          sampleRate: 48000,
          channels: 2,
        })),
        seconds: 0.35,
        model: { modelVersion: "synthetic", voiceReferenceSHA256: "synthetic" },
      };
    }
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
  new LocalBuddyStore(dir + "/history"),
);
service.historyEnabled = async () => false;
const origin = "http://127.0.0.1:3198";
const hub = new RealtimeTalkHub(
  service,
  core,
  { getUser: async () => ({ id: user }) },
  { assertAiAccess: async () => {} } as any,
  new Set([origin]),
  { decide: async () => ({ decision: "ACCESS_GRANTED" }) } as any,
);
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  try {
    let raw = "";
    for await (const part of req) raw += part;
    if (req.headers.authorization !== "Bearer " + token) throw Error("auth");
    const value = req.url?.endsWith("/refresh")
      ? await hub.refresh(user, req.url.split("/").at(-2)!, token)
      : await hub.create(user, token, JSON.parse(raw));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: value }));
  } catch {
    res.statusCode = 400;
    res.end("{}");
  }
});
hub.attach(server);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const api = "http://127.0.0.1:" + (server.address() as any).port + "/api/v1";
await writeFile(dir + "/env.ts", "export const env={apiBaseUrl:" + JSON.stringify(api) + "};");
await writeFile(
  dir + "/auth.ts",
  "export const supabaseAuthTokenProvider={getAccessToken:async()=>" + JSON.stringify(token) + "};",
);
await writeFile(dir + "/index.html", '<div id="root"></div><script type="module" src="/main.tsx"></script>');
await writeFile(
  dir + "/main.tsx",
  `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useRealtimeTalk} from '@talk';import {BuddyTalkAvatar} from '@avatar';
function App(){const [messages,setMessages]=useState([]);const t=useRealtimeTalk({conversationId:null,
getTemporarySessionId:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',onMessage:m=>setMessages(x=>[...x,m]),onDelivery:()=>{}});
window.__buddy=t;return <><button onClick={()=>void t.start()}>Start Talk</button><button onClick={t.stop}>Stop Talk</button>
<button onClick={t.interrupt}>Interrupt</button><button onClick={()=>void t.resumePlayback()}>Play</button>
<button onClick={t.retrySpeech}>Retry speech</button><p id="state">{t.state}</p><p id="error">{t.error}</p>
<div id="messages">{messages.map(m=><p key={m.id}>{m.content}</p>)}</div><BuddyTalkAvatar state={t.state} analyser={t.analyser}/></>}
createRoot(document.getElementById('root')).render(<App/>);`,
);
const vite = await createVite({
  configFile: false,
  envDir: false,
  plugins: [react()],
  root: dir,
  publicDir: root + "frontend/public",
  server: { host: "127.0.0.1", port: 3198, strictPort: true, fs: { allow: [root] } },
  resolve: {
    alias: {
      "@talk": root + "frontend/src/features/buddy/view-model/use-realtime-talk.ts",
      "@avatar": root + "frontend/src/features/buddy/components/buddy-talk-avatar.tsx",
      "@/config/environment": dir + "/env.ts",
      "@/infrastructure/api/supabase-auth-token-provider": dir + "/auth.ts",
    },
  },
  define: { "process.env.NEXT_PUBLIC_REALTIME_TALK": JSON.stringify("true") },
});
let browser: any;
const errors: string[] = [],
  states: string[] = [];
try {
  await vite.listen();
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e: any) => errors.push(e.message));
  await page.addInitScript(() => {
    const w = window as any;
    w.__micCalls = 0;
    w.__contexts = [];
    const Original = AudioContext;
    (window as any).AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__contexts.push(this);
      }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      w.__micCalls++;
      const ctx = new Original({ sampleRate: 48000 }),
        osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        dest = ctx.createMediaStreamDestination();
      osc.frequency.value = 330;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      await ctx.resume();
      w.__mic = { ctx, gain, stream: dest.stream };
      return dest.stream;
    };
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Start Talk", exact: true }).click();
  const state = async (value: string) => {
    await page.waitForFunction((v) => document.querySelector("#state")?.textContent === v, value, { timeout: 20000 });
    states.push(value);
  };
  const utter = async () => {
    await page.evaluate(() => {
      (window as any).__mic.gain.gain.value = 0.1;
    });
    await pause(700);
    await page.evaluate(() => {
      (window as any).__mic.gain.gain.value = 0;
    });
  };
  await state("listening");
  await utter();
  await state("thinking");
  assert.equal(await page.evaluate(() => (window as any).__mic.stream.getAudioTracks()[0].enabled), false);
  await state("speaking");
  await state("listening");
  assert.deepEqual(schedules.slice(0, 4), [1, 1, 3, 2]);
  assert.equal(await page.evaluate(() => (window as any).__micCalls), 1);
  await utter();
  await state("thinking");
  await page.evaluate(() => (window as any).__contexts[0].suspend());
  await state("playback_blocked");
  assert.equal(await page.evaluate(() => (window as any).__mic.stream.getAudioTracks()[0].enabled), false);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await state("listening");
  failNextSpeech = true;
  await utter();
  await state("speech_failed");
  const before = tasks.filter((t) => t === "chat").length;
  await page.getByRole("button", { name: "Retry speech", exact: true }).click();
  await state("listening");
  assert.equal(tasks.filter((t) => t === "chat").length, before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await utter();
  await state("speaking");
  assert.equal(await page.locator("svg ellipse").getAttribute("ry"), "2");
  await page.getByRole("button", { name: "Interrupt", exact: true }).click();
  await state("listening");
  await page.getByRole("button", { name: "Stop Talk", exact: true }).click();
  await state("idle");
  assert.equal(
    await page.evaluate(() =>
      (window as any).__mic.stream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
    true,
  );
  const count = await page.locator("#messages p").count();
  await pause(700);
  assert.equal(await page.locator("#messages p").count(), count);
  await page.evaluate(() => (window as any).__mic.ctx.close());
  await pause(100);
  await page.getByRole("button", { name: "Start Talk", exact: true }).click();
  await state("listening");
  await page.evaluate(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  await state("idle");
  assert.equal(await page.evaluate(() => (window as any).__mic.stream.getTracks()[0].readyState), "ended");
  await page.evaluate(() => (window as any).__mic.ctx.close());
  await pause(100);
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Synthetic microphone denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "Start Talk", exact: true }).click();
  await state("unavailable");
  assert.match(await page.locator("#error").textContent(), /denied/);
  assert.deepEqual(errors, []);
  await writeFile(
    root + ".git/buddy-browser-result.json",
    JSON.stringify(
      {
        passed: true,
        states,
        schedules,
        modelInference: "stubbed",
        microphone: "synthetic waveform; hardware not opened",
        checks: [
          "automatic turns",
          "one mic request",
          "processing/speech capture suspension",
          "stereo playback",
          "sentence schedule",
          "blocked playback and Play",
          "speech-only retry",
          "interrupt recovery",
          "Stop cleanup",
          "stale-result rejection",
          "logout cleanup",
          "microphone denial",
          "reduced-motion avatar",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Buddy browser checks passed (synthetic microphone, stubbed models).");
} finally {
  await browser?.close();
  await vite.close();
  await hub.shutdown();
  await new Promise<void>((r) => server.close(() => r()));
}
