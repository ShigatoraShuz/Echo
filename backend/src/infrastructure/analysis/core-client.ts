import { facialExpressionResultSchema } from "@echo/contracts";
import { z } from "zod";
import { journalAnalysisResultSchema } from "@echo/contracts";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

export type ChatTurn = { role: "user" | "assistant"; content: string };
const responseSchema = z.object({
  reply: z.string().min(1).max(12000).nullable(),
  supportRequired: z.boolean(),
  model: z.record(z.string(), z.unknown()).optional(),
  quality: z.record(z.string(), z.unknown()).optional(),
});
const warmResponseSchema = z
  .object({
    ready: z.literal(true),
    speech: z
      .object({ model: z.object({ whisperDevice: z.enum(["cuda", "cpu"]).optional() }).passthrough() })
      .passthrough()
      .optional(),
    freeGpuBytes: z.number().nonnegative().optional(),
  })
  .passthrough();
export class CoreClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}
  private async request(path: string, body: unknown, signal?: AbortSignal) {
    try {
      const response = await fetch(`${this.url.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),
      });
      if (!response.ok) {
        if (response.status === 503) {
          const value = await response.json().catch(() => null);
          if (value?.detail?.code === "TALK_BUSY")
            throw new ExternalServiceError("TALK_BUSY", "Journal inference is waiting while Talk is active.");
        }
        throw new Error();
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError("AI_UNAVAILABLE", "Local analysis is temporarily unavailable.");
    }
  }
  async speech(payload: { task: "speak" | "transcribe"; audio?: string; text?: string }, signal?: AbortSignal) {
    const value = z
      .object({
        audio: z.string().optional(),
        text: z.string().max(4000).optional(),
        model: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(await this.request("/v2/speech", payload, signal));
    if (payload.task === "transcribe" && typeof value.text !== "string")
      throw new ExternalServiceError("AI_UNAVAILABLE", "Invalid transcription output.");
    if (payload.task === "speak") {
      const bytes = Buffer.from(value.audio ?? "", "base64");
      if (bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WAVE")
        throw new ExternalServiceError("AI_UNAVAILABLE", "Invalid speech output.");
    }
    return value;
  }
  async talk(
    payload: Record<string, unknown> & { task: "chat" },
    signal?: AbortSignal,
  ): Promise<z.infer<typeof responseSchema>>;
  async talk(
    payload: Record<string, unknown> & { task: "warm" },
    signal?: AbortSignal,
  ): Promise<z.infer<typeof warmResponseSchema>>;
  async talk(payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  async talk(payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const value = await this.request("/v1/talk", payload, signal);
    if (payload.task === "chat") return responseSchema.parse(value);
    if (payload.task === "warm") return warmResponseSchema.parse(value);
    return value;
  }
  private busyCache = { until: 0, value: false };
  private busyPending?: Promise<boolean>;
  async talkBusy(force = false): Promise<boolean> {
    if (!force && Date.now() < this.busyCache.until) return this.busyCache.value;
    if (this.busyPending) return this.busyPending;
    this.busyPending = (async () => {
      try {
        const r = await fetch(this.url.replace(/\/$/, "") + "/v2/runtime", {
          headers: { Authorization: "Bearer " + this.token },
          signal: AbortSignal.timeout(3000),
        });
        if (!r.ok) throw new Error("Runtime unavailable");
        const value = Boolean((await r.json()).talkActive);
        this.busyCache = { until: Date.now() + 2000, value };
        return value;
      } catch {
        return this.busyCache.value;
      } finally {
        this.busyPending = undefined;
      }
    })();
    return this.busyPending;
  }
  async face(image: Buffer) {
    return facialExpressionResultSchema.parse(await this.request("/v1/face", { image: image.toString("base64") }));
  }
  async screening(text: string) {
    return await this.request("/v3/screening", { text });
  }
  async classify(text: string) {
    return z
      .object({ suicidal_language_flag: z.boolean() })
      .parse(await this.request("/v2/classify", { text, language: "unknown" }));
  }
  async analyze(text: string) {
    return journalAnalysisResultSchema.parse(await this.request("/v2/analyze", { text, language: "unknown" }));
  }
  async chat(messages: ChatTurn[]) {
    try {
      const response = await fetch(`${this.url.replace(/\/$/, "")}/v2/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) throw new Error();
      const value = responseSchema.parse(await response.json());
      if (!value.supportRequired && !value.reply) throw new Error();
      return value;
    } catch {
      throw new ExternalServiceError("AI_UNAVAILABLE", "Buddy is temporarily unavailable. Please try again later.");
    }
  }
  async ready(): Promise<boolean> {
    try {
      return (await fetch(`${this.url.replace(/\/$/, "")}/ready`, { signal: AbortSignal.timeout(5000) })).ok;
    } catch {
      return false;
    }
  }
}
