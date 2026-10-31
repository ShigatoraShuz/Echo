import { it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { RealtimeTalkHub, speechPhrases } from "../../src/features/experience/realtime-talk.js";
import { ExperienceService } from "../../src/features/experience/experience.service.js";
import { LocalBuddyStore } from "../../src/infrastructure/analysis/local-buddy-store.js";

const user = randomUUID();
const token =
  "e30." +
  Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") +
  ".synthetic";
async function fixture(saving = false) {
  const base = resolve("../runtime-cache/talk-tests");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "session-"));
  const store = new LocalBuddyStore(dir);
  const core = {
    talk: vi.fn(async (p: any, signal?: AbortSignal): Promise<any> => {
      if (signal?.aborted) throw Error("cancel");
      if (p.task === "warm") return { ready: true };
      if (p.task === "transcribe") return { text: "Synthetic input", model: { version: "test" } };
      if (p.task === "chat")
        return { reply: "Take one small step.", supportRequired: false, model: { version: "test" } };
      if (p.task === "speak")
        return { audio: Buffer.alloc(16000, 8).toString("base64"), sampleRate: 16000, model: { version: "test" } };
      return {};
    }),
  };
  const db = new Proxy(
    {},
    {
      get() {
        throw Error("No cloud data writes allowed");
      },
    },
  );
  const service: any = new ExperienceService(db as any, {} as any, {} as any, undefined, undefined, core as any, store);
  service.historyEnabled = async () => saving;
  const access = { decide: vi.fn(async () => ({ decision: "ACCESS_GRANTED" })) };
  const hub = new RealtimeTalkHub(
    service,
    core as any,
    { getUser: async (t) => (t === token ? { id: user } : null) },
    { assertAiAccess: async () => {} } as any,
    new Set(["http://localhost:3000"]),
    access as any,
  );
  const server = createServer((_, res) => res.end());
  hub.attach(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as any;
  const session = await hub.create(user, token, { temporarySessionId: randomUUID() });
  const ws = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/buddy/voice/stream`, {
    origin: "http://localhost:3000",
  });
  const events: any[] = [];
  ws.on("error", () => {});
  ws.on("message", (raw) => events.push(JSON.parse(raw.toString())));
  await once(ws, "open");
  const send = (event: any) => ws.send(JSON.stringify(event));
  async function wait(type: string) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const value = events.find((x) => x.type === type);
      if (value) return value;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Missing " + type);
  }
  const close = async () => {
    ws.close();
    await hub.shutdown();
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  };
  return { core, service, store, dir, hub, ws, events, access, session, send, wait, close };
}
it("streams only approved speech, persists text locally and marks interruption", async () => {
  const f = await fixture(true);
  try {
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    const reply = await f.wait("approved_reply");
    await f.wait("audio");
    f.send({ type: "cancel", generation: 1 });
    await f.wait("delivery");
    const c = f.store.get(user, reply.conversationId);
    expect(c.messages.map((m) => m.role)).toEqual(["user", "buddy"]);
    expect(c.messages[1].delivery?.state).toBe("interrupted");
    const raw = readFileSync(join(f.dir, user, "buddy", c.id + ".json"), "utf8");
    expect(raw).not.toContain("audio");
    expect(raw).not.toContain(f.session.ticket);
    const synthesis = f.core.talk.mock.calls
      .filter(([p]) => p.task === "speak")
      .map(([p]) => p.text)
      .join("");
    expect(synthesis).toBe("Take one small step.");
  } finally {
    await f.close();
  }
});
it("rejects a second session and cross-account refresh", async () => {
  const f = await fixture();
  try {
    await expect(f.hub.create(user, token, { temporarySessionId: randomUUID() })).rejects.toThrow(/active/);
    await expect(f.hub.refresh(randomUUID(), f.session.sessionId, token)).rejects.toThrow(/unavailable/);
  } finally {
    await f.close();
  }
});
it("rejects an incorrect first-frame ticket", async () => {
  const f = await fixture();
  try {
    const closed = once(f.ws, "close");
    f.send({ type: "authenticate", ticket: "a".repeat(64) });
    expect((await closed)[0]).toBe(1008);
    expect(f.core.talk).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
it("rechecks account access before starting models", async () => {
  const f = await fixture();
  try {
    f.access.decide.mockResolvedValue({ decision: "DELETION_PENDING" });
    f.send({ type: "authenticate", ticket: f.session.ticket });
    const state = await f.wait("state");
    expect(state.state).toBe("preparing");
    await new Promise((r) => setTimeout(r, 30));
    expect(f.core.talk.mock.calls.some(([p]) => p.task === "warm")).toBe(false);
  } finally {
    await f.close();
  }
});
it("keeps history-disabled turns entirely temporary", async () => {
  const f = await fixture(false);
  try {
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    await f.wait("approved_reply");
    expect(f.store.list(user)).toHaveLength(0);
  } finally {
    await f.close();
  }
});
it("preserves the exact approved text across language-specific phrase chunks", () => {
  for (const text of [
    "Okay lang magpahinga. We can take one small step.",
    "One sentence " + "with several words ".repeat(35),
  ]) {
    const chunks = speechPhrases(text);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
    expect(chunks.every((c) => c.text.length <= 240)).toBe(true);
  }
  expect(speechPhrases("Okay lang magpahinga. Hello.").map((x) => x.language)).toEqual(["tgl", "eng"]);
});

it("rejects duplicate completed-turn submissions without saving twice", async () => {
  const f = await fixture(true);
  try {
    const turn = randomUUID();
    const accepted = await f.service.acceptTalkTurn(user, "Synthetic", null, randomUUID(), turn);
    await expect(
      f.service.acceptTalkTurn(user, "Synthetic", accepted.conversationId, randomUUID(), turn),
    ).rejects.toThrow(/already accepted/);
    expect(f.store.get(user, accepted.conversationId).messages).toHaveLength(1);
  } finally {
    await f.close();
  }
});
it("stops before inference when history privacy changes during a session", async () => {
  const f = await fixture(false);
  try {
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    f.service.historyEnabled = async () => true;
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    await f.wait("error");
    expect(f.core.talk.mock.calls.some(([p]) => p.task === "chat")).toBe(false);
    expect(f.store.list(user)).toHaveLength(0);
  } finally {
    await f.close();
  }
});
it("rejects out-of-order PCM without accepting a user message", async () => {
  const f = await fixture(true);
  try {
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    f.send({ type: "begin", generation: 1, turnId: randomUUID() });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    frame.writeUInt32LE(9, 4);
    const closed = once(f.ws, "close");
    f.ws.send(frame);
    await closed;
    expect(f.store.list(user)).toHaveLength(0);
  } finally {
    await f.close();
  }
});
it("does not synthesize or save a cancelled unchecked response", async () => {
  const f = await fixture(true);
  try {
    let entered!: () => void;
    const generating = new Promise<void>((r) => (entered = r));
    const original = f.core.talk.getMockImplementation()!;
    f.core.talk.mockImplementation(async (p, signal) => {
      if (p.task === "chat") {
        entered();
        await new Promise((r) => setTimeout(r, 50));
        if (signal?.aborted) throw Error("cancelled");
        return { reply: "Unchecked draft", supportRequired: false };
      }
      return original(p, signal);
    });
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    await generating;
    f.send({ type: "cancel", generation: 1 });
    await new Promise((r) => setTimeout(r, 100));
    expect(f.core.talk.mock.calls.some(([p]) => p.task === "speak")).toBe(false);
    expect(
      f.store
        .list(user)
        .flatMap((c) => c.messages)
        .map((m) => m.role),
    ).toEqual(["user"]);
  } finally {
    await f.close();
  }
});
it("keeps an approved reply when the speech provider returns malformed audio", async () => {
  const f = await fixture(true);
  try {
    const original = f.core.talk.getMockImplementation()!;
    f.core.talk.mockImplementation(async (p, signal) =>
      p.task === "speak" ? { audio: "not-base64", sampleRate: 16000, model: { version: "test" } } : original(p, signal),
    );
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    const reply = await f.wait("approved_reply");
    expect((await f.wait("error")).code).toBe("SPEECH_UNAVAILABLE");
    expect(f.events.some((e) => e.type === "audio")).toBe(false);
    expect(f.store.get(user, reply.conversationId).messages[1].content).toBe("Take one small step.");
  } finally {
    await f.close();
  }
});

it.each([true, false])("shares Talk and typed Chat context when saving is %s", async (saving) => {
  const f = await fixture(saving);
  try {
    const temp = randomUUID();
    const spoken = await f.service.acceptTalkTurn(user, "Spoken first turn", null, temp, randomUUID());
    const last = await f.service.completeTalk(
      user,
      spoken.conversationId,
      temp,
      "Approved first answer",
      spoken.message.id,
      {},
    );
    (f.core as any).chat = vi.fn(async () => ({ reply: "Typed reply", supportRequired: false }));
    const typed = await f.service.sendBuddyMessage(user, "Typed followup", last.conversationId ?? undefined, temp);
    expect((f.core as any).chat.mock.calls[0][0].map((m: any) => m.content)).toEqual([
      "Spoken first turn",
      "Approved first answer",
      "Typed followup",
    ]);
    const again = await f.service.acceptTalkTurn(user, "Spoken followup", typed.conversationId, temp, randomUUID());
    expect(again.messages.map((m: any) => m.content)).toContain("Typed reply");
    if (!saving) expect(f.store.list(user)).toHaveLength(0);
  } finally {
    await f.close();
  }
});

it("serializes an interrupted approval save before accepting the next turn", async () => {
  const f = await fixture(true);
  try {
    let entered!: () => void, release!: () => void;
    const entering = new Promise<void>((r) => (entered = r)),
      hold = new Promise<void>((r) => (release = r));
    const original = f.service.completeTalk.bind(f.service);
    let first = true;
    f.service.completeTalk = async (...args: unknown[]) => {
      if (first) {
        first = false;
        entered();
        await hold;
      }
      return original(...args);
    };
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const one = randomUUID();
    f.send({ type: "begin", generation: 1, turnId: one });
    let frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId: one });
    await entering;
    f.send({ type: "cancel", generation: 1 });
    const two = randomUUID();
    f.send({ type: "begin", generation: 2, turnId: two });
    frame = Buffer.alloc(1032);
    frame.writeUInt32LE(2, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 2, turnId: two });
    await new Promise((r) => setTimeout(r, 20));
    release();
    const reply = await f.wait("approved_reply");
    expect(reply.generation).toBe(2);
    const c = f.store.get(user, reply.conversationId);
    expect(f.store.list(user)).toHaveLength(1);
    expect(c.messages.map((m) => m.role)).toEqual(["user", "buddy", "user", "buddy"]);
    expect(c.messages[1].delivery?.state).toBe("interrupted");
    expect(c.messages[3].delivery).toBeUndefined();
  } finally {
    await f.close();
  }
});
it("reports failed delivery-metadata persistence without claiming playback succeeded", async () => {
  const f = await fixture(true);
  try {
    f.service.talkDelivery = () => {
      throw Error("Synthetic disk failure");
    };
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    const turnId = randomUUID();
    f.send({ type: "begin", generation: 1, turnId });
    const frame = Buffer.alloc(1032);
    frame.writeUInt32LE(1, 0);
    f.ws.send(frame);
    f.send({ type: "finish", generation: 1, turnId });
    await f.wait("audio");
    f.send({ type: "cancel", generation: 1 });
    expect((await f.wait("error")).code).toBe("DELIVERY_UNAVAILABLE");
    expect(f.events.some((e) => e.type === "delivery")).toBe(false);
    expect(f.store.list(user)[0].messages).toHaveLength(2);
  } finally {
    await f.close();
  }
});

it("rejects a replayed WebSocket ticket", async () => {
  const f = await fixture();
  let second: WebSocket | undefined;
  try {
    f.send({ type: "authenticate", ticket: f.session.ticket });
    await f.wait("ready");
    second = new WebSocket(f.ws.url, { origin: "http://localhost:3000" });
    second.on("error", () => {});
    await once(second, "open");
    const closed = once(second, "close");
    second.send(JSON.stringify({ type: "authenticate", ticket: f.session.ticket }));
    expect((await closed)[0]).toBe(1008);
    expect(f.core.talk.mock.calls.filter(([p]) => p.task === "warm")).toHaveLength(1);
  } finally {
    second?.close();
    await f.close();
  }
});
it("rejects origins outside the installation allowlist", async () => {
  const f = await fixture();
  let second: WebSocket | undefined;
  try {
    second = new WebSocket(f.ws.url, { origin: "https://untrusted.invalid" });
    const failure = once(second, "error");
    await failure;
    expect(f.core.talk.mock.calls.some(([p]) => p.task === "warm")).toBe(false);
  } finally {
    second?.close();
    await f.close();
  }
});
it("rejects expired session claims without model loading", async () => {
  const f = await fixture();
  try {
    await f.hub.end(user, f.session.sessionId);
    const expired = "e30." + Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url") + ".synthetic";
    await expect(f.hub.create(user, expired, { temporarySessionId: randomUUID() })).rejects.toThrow(/Authentication/);
    expect(f.core.talk.mock.calls.some(([p]) => p.task === "warm")).toBe(false);
  } finally {
    await f.close();
  }
});
