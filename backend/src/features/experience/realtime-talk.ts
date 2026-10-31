import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { TALK_PROTOCOL, talkClientEventSchema, talkSessionInputSchema, type TalkDelivery } from "@echo/contracts";
import type { ExperienceService } from "./experience.service.js";
import type { CoreClient } from "../../infrastructure/analysis/core-client.js";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import type { AccessService } from "../access/access.service.js";
import type { VerificationService } from "../verification/verification.service.js";
import { runWithRequestContext } from "../../shared/request-context.js";
import { ConflictError, NotFoundError, AuthenticationError } from "../../shared/errors/app-error.js";

type Session = {
  finishTail: Promise<void>;
  pendingTurns: number;
  historyEnabled: boolean;
  id: string;
  user: string;
  token: string;
  ticket: Buffer;
  ticketUntil: number;
  expires: number;
  created: number;
  lastActivity: number;
  conversationId: string | null;
  temporarySessionId: string;
  ws?: WebSocket;
  generation: number;
  turnId?: string;
  frames: Buffer[];
  bytes: number;
  frameSequence: number;
  partialAt: number;
  partialBusy: boolean;
  finalizing: boolean;
  ready: boolean;
  seen: Set<string>;
  abort: AbortController;
  partialAbort: AbortController;
  replyId?: string;
  playedSamples: number;
  sent: number;
  acked: number;
  inflight: Map<number, number>;
  finalSequence?: number;
  rate: number;
  window: number;
  closed: boolean;
};
const speechSchema = z.object({
  audio: z.string().max(4_000_000),
  sampleRate: z.number().int().min(8000).max(48000),
  model: z.record(z.string(), z.unknown()),
});
const transcriptSchema = z.object({
  text: z.string().max(4000),
  language: z.string().optional(),
  model: z.record(z.string(), z.unknown()).optional(),
});
const hash = (value: string) => createHash("sha256").update(value).digest();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function speechPhrases(text: string): Array<{ text: string; language: "eng" | "tgl" }> {
  const spans = text.match(/[^.!?]+[.!?]*\s*|[.!?]+\s*/gu) ?? [];
  const result: Array<{ text: string; language: "eng" | "tgl" }> = [];
  for (const span of spans) {
    let rest = span;
    while (rest) {
      let length = Math.min(rest.length, 240);
      if (length < rest.length) {
        const space = rest.lastIndexOf(" ", length - 1);
        if (space < 1) throw Error("Speech contains an oversized token");
        length = space + 1;
      }
      const part = rest.slice(0, length);
      rest = rest.slice(length);
      const language =
        /\b(ako|ikaw|ka|ko|mo|naman|lang|hindi|maaaring|puwede|pwede|tayo|ang|ng|sa|para|iyong|mong|kaya|pagod|maging|isang|ito|iyon|nararamdaman|muna|dahan)\b/iu.test(
          part,
        )
          ? "tgl"
          : "eng";
      result.push({ text: part, language });
    }
  }
  if (result.map((x) => x.text).join("") !== text) throw Error("Speech must preserve the approved reply");
  return result;
}

export class RealtimeTalkHub {
  private active?: Session;
  private anonymous = 0;
  private timer: ReturnType<typeof setInterval>;
  private wss = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false });
  constructor(
    private service: ExperienceService,
    private core: CoreClient,
    private verifier: AccessTokenVerifier,
    private verification: VerificationService,
    private origins: Set<string>,
    private access: AccessService,
  ) {
    this.timer = setInterval(() => {
      const s = this.active;
      if (
        s &&
        !s.closed &&
        (Date.now() > s.expires ||
          (!s.ws && Date.now() > s.ticketUntil) ||
          (s.ready && Date.now() - s.lastActivity > 60000))
      )
        void this.close(s, "paused");
    }, 1000);
    this.timer.unref();
  }
  private expiry(token: string) {
    try {
      const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp;
      if (!Number.isFinite(exp)) throw Error();
      return Math.min(Date.now() + 30 * 60000, exp * 1000);
    } catch {
      throw new AuthenticationError("INVALID_ACCESS_TOKEN", "A current session is required.");
    }
  }
  async create(user: string, token: string, input: unknown) {
    if (this.active && !this.active.closed)
      throw new ConflictError("TALK_BUSY", "Another Talk session is active on this installation.");
    const args = talkSessionInputSchema.parse(input),
      context = await this.service.startTalkContext(user, args.conversationId);
    const ticket = randomBytes(32).toString("hex"),
      expires = this.expiry(token);
    if (expires <= Date.now()) throw new AuthenticationError();
    // Reserve synchronously after the asynchronous ownership/consent check.
    if (this.active && !this.active.closed) throw new ConflictError("TALK_BUSY", "Another Talk session is active.");
    const s: Session = {
      finishTail: Promise.resolve(),
      pendingTurns: 0,
      historyEnabled: context.historyEnabled,
      id: randomUUID(),
      user,
      token,
      ticket: hash(ticket),
      ticketUntil: Date.now() + 30000,
      expires,
      created: Date.now(),
      lastActivity: Date.now(),
      conversationId: context.conversationId,
      temporarySessionId: args.temporarySessionId,
      generation: 0,
      frames: [],
      bytes: 0,
      frameSequence: 0,
      partialAt: 0,
      partialBusy: false,
      finalizing: false,
      ready: false,
      seen: new Set(),
      abort: new AbortController(),
      partialAbort: new AbortController(),
      playedSamples: 0,
      sent: 0,
      acked: 0,
      inflight: new Map(),
      rate: 0,
      window: Date.now(),
      closed: false,
    };
    this.active = s;
    return {
      protocol: TALK_PROTOCOL,
      sessionId: s.id,
      ticket,
      expiresAt: new Date(expires).toISOString(),
      webSocketPath: "/api/v1/buddy/voice/stream",
      experimental: true,
    };
  }
  private owned(user: string, id: string) {
    const s = this.active;
    if (!s || s.closed || s.user !== user || s.id !== id) throw new NotFoundError("Talk session unavailable.");
    return s;
  }
  async refresh(user: string, id: string, token: string) {
    const s = this.owned(user, id);
    await this.service.validateTalk(user);
    s.expires = Math.min(s.created + 30 * 60000, this.expiry(token));
    s.token = token;
    return { expiresAt: new Date(s.expires).toISOString() };
  }
  async end(user: string, id: string) {
    await this.close(this.owned(user, id), "paused");
  }
  attach(server: Server) {
    server.on("upgrade", (request, socket, head) => {
      if (
        request.url !== "/api/v1/buddy/voice/stream" ||
        !this.origins.has(request.headers.origin ?? "") ||
        this.anonymous >= 8
      ) {
        socket.destroy();
        return;
      }
      this.anonymous++;
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        let authenticated = false;
        let session: Session | undefined;
        const timeout = setTimeout(() => ws.close(1008, "Authentication required"), 5000);
        ws.on("error", () => {});
        ws.once("close", () => {
          clearTimeout(timeout);
          if (!authenticated) this.anonymous--;
          if (session) void this.close(session, "paused");
        });
        ws.on("message", (data, isBinary) => {
          if (!authenticated) {
            try {
              if (isBinary) throw Error();
              const event = talkClientEventSchema.parse(JSON.parse(data.toString()));
              const s = this.active;
              if (
                event.type !== "authenticate" ||
                !s ||
                s.closed ||
                s.ws ||
                Date.now() > s.ticketUntil ||
                !timingSafeEqual(hash(event.ticket), s.ticket)
              )
                throw Error();
              s.ticket.fill(0);
              s.ws = ws;
              session = s;
              authenticated = true;
              this.anonymous--;
              clearTimeout(timeout);
              this.send(s, { type: "state", state: "preparing" });
              void this.prepare(s);
            } catch {
              ws.close(1008, "Invalid ticket");
            }
            return;
          }
          const s = session!;
          if (s.closed) return;
          if (Date.now() - s.window > 1000) {
            s.window = Date.now();
            s.rate = 0;
          }
          if (++s.rate > 75) {
            void this.close(s, "unavailable");
            return;
          }
          try {
            if (isBinary) {
              this.frame(s, Buffer.from(data as Buffer));
              return;
            }
            const event = talkClientEventSchema.parse(JSON.parse(data.toString()));
            if (event.type === "stop") {
              void this.close(s, "paused");
              return;
            }
            if (event.type === "ping") {
              if (Date.now() > s.expires) {
                void this.close(s, "auth_required");
                return;
              }
              this.send(s, { type: "pong" });
              if (s.ready)
                void this.core.talk({ task: "pulse", sessionId: s.id }).catch(() => this.close(s, "unavailable"));
              return;
            }
            if (event.type === "played") {
              if (
                event.generation !== s.generation ||
                event.turnId !== s.turnId ||
                !s.inflight.has(event.sequence) ||
                event.sequence !== s.acked
              )
                return;
              const samples = s.inflight.get(event.sequence)!;
              if (event.samples !== samples) throw Error();
              s.inflight.delete(event.sequence);
              s.acked++;
              s.playedSamples += samples;
              if (s.finalSequence !== undefined && s.acked === s.finalSequence) this.markDelivery(s, "played");
              return;
            }
            if (!s.ready) throw Error();
            if (event.type === "cancel") {
              if (event.generation === s.generation) this.cancel(s);
              return;
            }
            if (event.type === "begin") {
              if (event.generation !== s.generation + 1 || s.seen.has(event.turnId) || s.seen.size >= 120)
                throw Error();
              this.cancel(s);
              s.generation = event.generation;
              s.turnId = event.turnId;
              s.seen.add(event.turnId);
              s.abort = new AbortController();
              s.partialAbort = new AbortController();
              s.bytes = 0;
              s.frameSequence = 0;
              s.partialAt = 0;
              s.finalizing = false;
              s.lastActivity = Date.now();
              this.send(s, { type: "state", state: "listening" });
              return;
            }
            if (
              event.type === "finish" &&
              event.generation === s.generation &&
              event.turnId === s.turnId &&
              !s.finalizing
            ) {
              if (s.pendingTurns >= 2) throw Error("Too many pending turns");
              s.finalizing = true;
              s.lastActivity = Date.now();
              s.partialAbort.abort();
              const generation = s.generation,
                turnId = s.turnId!,
                controller = s.abort,
                audio = Buffer.concat(s.frames);
              this.clearFrames(s);
              s.pendingTurns++;
              s.finishTail = s.finishTail
                .then(() => this.finish(s, generation, turnId, audio, controller))
                .catch(() => this.close(s, "unavailable"))
                .finally(() => {
                  s.pendingTurns--;
                  audio.fill(0);
                });
            }
          } catch {
            void this.close(s, "unavailable");
          }
        });
      });
    });
  }
  private send(s: Session, event: Record<string, unknown>) {
    if (!s.closed && s.ws?.readyState === WebSocket.OPEN) {
      if (s.ws.bufferedAmount > 256 * 1024) throw Error("Backpressure");
      s.ws.send(
        JSON.stringify({
          protocol: TALK_PROTOCOL,
          sessionId: s.id,
          generation: s.generation,
          turnId: s.turnId,
          ...event,
        }),
      );
    }
  }
  private context<T>(s: Session, fn: () => Promise<T>) {
    return runWithRequestContext({ requestId: randomUUID(), accessToken: s.token }, fn);
  }
  private async authorize(s: Session) {
    if (s.closed || Date.now() > s.expires) throw new AuthenticationError();
    const user = await this.verifier.getUser(s.token);
    if (!user || user.id !== s.user) throw new AuthenticationError();
    if ((await this.access.decide(user)).decision !== "ACCESS_GRANTED") throw new AuthenticationError();
    await this.verification.assertAiAccess(s.user);
    const privacy = await this.service.validateTalk(s.user);
    if (privacy.historyEnabled !== s.historyEnabled)
      throw new ConflictError("TALK_PRIVACY_CHANGED", "Restart Talk to apply privacy changes.");
    if (s.conversationId) await this.service.ensureOwnedConversation(s.user, s.conversationId);
  }
  private async prepare(s: Session) {
    try {
      await this.context(s, async () => {
        await this.authorize(s);
        const warm = await this.core.talk({ task: "warm", sessionId: s.id }, s.abort.signal);
        if (s.closed) return;
        s.ready = true;
        s.lastActivity = Date.now();
        this.send(s, {
          type: "ready",
          experimental: true,
          runtime: { whisperDevice: warm.speech?.model?.whisperDevice, freeGpuBytes: warm.freeGpuBytes },
        });
      });
    } catch {
      await this.close(s, "unavailable");
    }
  }
  private frame(s: Session, data: Buffer) {
    if (!s.ready || !s.turnId || s.finalizing || data.length < 10 || data.length > 16392 || data.length % 2)
      throw Error();
    const generation = data.readUInt32LE(0),
      sequence = data.readUInt32LE(4);
    if (generation !== s.generation) return;
    if (sequence !== s.frameSequence++) throw Error();
    const pcm = Buffer.from(data.subarray(8));
    s.bytes += pcm.length;
    if (s.bytes > 60 * 16000 * 2) throw Error();
    s.frames.push(pcm);
    s.lastActivity = Date.now();
    if (!s.partialBusy && s.bytes - s.partialAt >= 16000 * 2 * 2) {
      s.partialAt = s.bytes;
      s.partialBusy = true;
      const current = s.generation;
      const snapshot = Buffer.concat(s.frames).subarray(-8 * 16000 * 2);
      void this.context(s, async () => {
        await this.authorize(s);
        return this.core.talk(
          { task: "transcribe", sessionId: s.id, audio: snapshot.toString("base64") },
          s.partialAbort.signal,
        );
      })
        .then((value) => {
          if (!s.closed && !s.finalizing && s.generation === current) {
            const text = transcriptSchema.parse(value).text;
            this.send(s, { type: "partial", text });
          }
        })
        .catch((error) => {
          if (error instanceof AuthenticationError || error instanceof ConflictError || error instanceof NotFoundError)
            void this.close(s, "paused");
        })
        .finally(() => {
          s.partialBusy = false;
        });
    }
  }
  private async finish(s: Session, generation: number, turnId: string, audio: Buffer, controller: AbortController) {
    const current = () => !s.closed && !controller.signal.aborted && s.generation === generation;
    if (!current()) return;
    try {
      await this.context(s, async () => {
        await this.authorize(s);
        if (!current()) return;
        this.send(s, { type: "state", state: "transcribing" });
        const transcription = transcriptSchema.parse(
          await this.core.talk(
            { task: "transcribe", sessionId: s.id, audio: audio.toString("base64") },
            controller.signal,
          ),
        );
        if (!current()) return;
        if (!transcription.text.trim()) {
          this.send(s, { type: "turn_end", empty: true });
          return;
        }
        await this.authorize(s);
        if (!current()) return;
        const accepted = await this.service.acceptTalkTurn(
          s.user,
          transcription.text,
          s.conversationId,
          s.temporarySessionId,
          turnId,
        );
        s.conversationId = accepted.conversationId;
        if (transcription.model)
          this.service.talkProvenance(s.user, s.conversationId, turnId, "stt", transcription.model);
        if (!current()) return;
        this.send(s, {
          type: "final_transcript",
          text: transcription.text,
          conversationId: s.conversationId,
          message: accepted.message,
        });
        this.send(s, { type: "state", state: "thinking" });
        const approved = await this.service.generateTalk(s.user, s.id, accepted.messages, controller.signal);
        if (!current()) return;
        await this.authorize(s);
        if (!current()) return;
        const completion = await this.service.completeTalk(
          s.user,
          s.conversationId,
          s.temporarySessionId,
          approved.reply,
          turnId,
          { model: approved.model, quality: approved.quality, supportRequired: approved.supportRequired },
        );
        s.conversationId = completion.conversationId;
        if (!current()) {
          this.service.talkDelivery(s.user, s.conversationId, completion.message.id, {
            state: "interrupted",
            playedMs: 0,
          });
          return;
        }
        s.replyId = completion.message.id;
        this.send(s, {
          type: "approved_reply",
          conversationId: s.conversationId,
          message: completion.message,
          supportRequired: approved.supportRequired,
        });
        s.sent = 0;
        s.acked = 0;
        s.inflight.clear();
        s.playedSamples = 0;
        s.finalSequence = undefined;
        for (const phrase of speechPhrases(approved.reply)) {
          if (!current()) return;
          await this.authorize(s);
          if (!current()) return;
          const spoken = speechSchema.parse(
            await this.core.talk({ task: "speak", sessionId: s.id, ...phrase }, controller.signal),
          );
          if (spoken.sampleRate !== 16000) throw Error("Unsupported sample rate");
          if (!current()) return;
          await this.authorize(s);
          if (!current()) return;
          const pcm = Buffer.from(spoken.audio, "base64");
          if (!pcm.length || pcm.length % 2 || pcm.length > 45 * 16000 * 2 || pcm.toString("base64") !== spoken.audio)
            throw Error("Invalid speech payload");
          let audible = false;
          for (let offset = 0; offset < pcm.length; offset += 2)
            if (Math.abs(pcm.readInt16LE(offset)) > 1) {
              audible = true;
              break;
            }
          if (!audible) throw Error("Silent speech payload");
          this.service.talkProvenance(s.user, s.conversationId, turnId, "tts", spoken.model);
          this.send(s, { type: "voice", language: phrase.language, model: spoken.model });
          for (let offset = 0; offset < pcm.length; offset += 8000) {
            const deadline = Date.now() + 15000;
            while (current() && (s.inflight.size >= 8 || s.ws!.bufferedAmount > 128 * 1024)) {
              if (Date.now() > deadline) throw Error("Playback stalled");
              await delay(25);
            }
            if (!current()) return;
            const frame = pcm.subarray(offset, offset + 8000);
            const sequence = s.sent++;
            s.inflight.set(sequence, frame.length / 2);
            s.lastActivity = Date.now();
            this.send(s, { type: "audio", sequence, sampleRate: 16000, audio: frame.toString("base64") });
          }
          pcm.fill(0);
        }
        if (current()) {
          s.finalSequence = s.sent;
          this.send(s, { type: "audio_end", sequence: s.sent });
          if (s.acked === s.sent) this.markDelivery(s, "played");
        }
      });
    } catch {
      if (current()) {
        this.send(s, {
          type: "error",
          code: s.replyId ? "SPEECH_UNAVAILABLE" : "TURN_UNAVAILABLE",
          message: s.replyId
            ? "The approved text reply is available, but speech could not finish."
            : "This turn could not finish. Text already accepted remains saved; restart Talk to retry.",
        });
        this.send(s, { type: "state", state: "unavailable" });
      }
    } finally {
      audio.fill(0);
      if (current()) s.finalizing = false;
    }
  }
  private clearFrames(s: Session) {
    for (const frame of s.frames) frame.fill(0);
    s.frames = [];
    s.bytes = 0;
  }
  private markDelivery(s: Session, state: TalkDelivery["state"]) {
    if (!s.replyId) return;
    try {
      this.service.talkDelivery(s.user, s.conversationId, s.replyId, { state, playedMs: s.playedSamples / 16 });
      this.send(s, { type: "delivery", messageId: s.replyId, state, playedMs: s.playedSamples / 16 });
    } catch {
      s.replyId = undefined;
      this.send(s, {
        type: "error",
        code: "DELIVERY_UNAVAILABLE",
        message: "The reply is available, but local playback metadata could not be saved.",
      });
      return;
    }
    if (state === "played") {
      this.send(s, { type: "turn_end" });
      s.replyId = undefined;
    }
  }
  private cancel(s: Session) {
    s.abort.abort();
    s.partialAbort.abort();
    this.clearFrames(s);
    if (s.replyId) this.markDelivery(s, "interrupted");
    s.replyId = undefined;
    s.inflight.clear();
    s.finalSequence = undefined;
    this.send(s, { type: "cancelled" });
  }
  private async close(s: Session, state: string) {
    if (s.closed) return;
    try {
      this.cancel(s);
      this.send(s, { type: "state", state });
    } catch {
      // Cleanup must continue even when a disconnected socket rejects the final event.
    }
    s.closed = true;
    s.token = "";
    s.ticket.fill(0);
    s.ws?.close(1000, "Talk ended");
    if (this.active === s) this.active = undefined;
    await this.core.talk({ task: "close", sessionId: s.id }).catch(() => {});
  }
  async endConversation(user: string, conversationId: string) {
    if (this.active?.user === user && this.active.conversationId === conversationId)
      await this.close(this.active, "paused");
  }
  async endUser(user: string) {
    if (this.active?.user === user) await this.close(this.active, "paused");
  }
  async shutdown() {
    clearInterval(this.timer);
    if (this.active) await this.close(this.active, "paused");
    this.wss.close();
  }
}
