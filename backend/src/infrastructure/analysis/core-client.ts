import { modelPreparationSchema, facialExpressionResultSchema } from "@echo/contracts";
import { z } from "zod";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema } from "@echo/contracts";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

/** Only preparation gets the full five-attempt envelope; inference stays bounded. */
export function coreRequestTimeout(path:string,body:unknown){
 const task=(body as {task?:unknown}|null)?.task;
 if(path==='/v2/journal-runtime'&&(body as {action?:string})?.action==='prepare')return 1_000_000;
 return path==='/v1/talk'&&['warm','warm_chat','warm_nano','warm_whisper'].includes(String(task))?6_600_000:path==='/v1/talk'?600_000:300_000;
}
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
  ) {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(endpoint.hostname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== "/" ||
      token.length < 32
    )
      throw new Error("Core inference requires a loopback origin and dedicated credential.");
  }
  private async readResponse(response: Response, limit = 1024 * 1024): Promise<unknown> {
    if (Number(response.headers.get("content-length") ?? 0) > limit || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error();
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  private async request(path: string, body: unknown, signal?: AbortSignal) {
    try {
      const encoded = JSON.stringify(body);
      const limit =
        path === "/v2/speech"
          ? 14 * 1024 * 1024
          : path === "/v1/face" || path === "/v1/talk"
            ? 3 * 1024 * 1024
            : 64 * 1024;
      if (Buffer.byteLength(encoded, "utf8") > limit) throw new Error();
      const response = await fetch(`${this.url.replace(/\/$/, "")}${path}`, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: encoded,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(coreRequestTimeout(path,body))])
          : AbortSignal.timeout(coreRequestTimeout(path,body)),
      });
      if (!response.ok) {
        if ([401,403].includes(response.status))
          throw new ExternalServiceError('AI_TRANSPORT_AUTH_FAILED','The private AI service rejected its connection credential. Restart Echo using one coordinated launcher.');
        if (response.status===429)
          throw new ExternalServiceError('AI_TRANSPORT_RATE_LIMITED','The local AI service is receiving too many requests. Wait briefly, then retry speech.');
        if (response.status === 503) {
          const value = (await this.readResponse(response).catch(() => null)) as { detail?: { code?: string } } | null;
          const code = value?.detail?.code;
          if (typeof code === "string" && /^(BUDDY|FACE|NATIVE)_[A-Z_]{1,70}$/.test(code))
            throw new ExternalServiceError(
              code,
              code === "BUDDY_CBT_ENV_ACCESS_DENIED"
                ? "Windows denied access to Thesis2_VENV. Restore access before starting Buddy."
                : code === "BUDDY_RESPONSE_WITHHELD"
                  ? "Buddy could not approve a complete reply. Please try again."
                  : code.startsWith('NATIVE_') ? 'Journal model loading failed: '+code
                  : "Buddy model readiness or inference failed: " + code,
            );
          if (value?.detail?.code === "TALK_BUSY")
            throw new ExternalServiceError("TALK_BUSY", "Journal inference is waiting while Talk is active.");
        }
        if(path==='/v1/talk'||path==='/v2/speech')
          throw new ExternalServiceError('AI_TRANSPORT_UNAVAILABLE','The local speech runtime is unavailable. Your approved answer is retained; retry speech after recovery.');
        throw new Error();
      }
      return await this.readResponse(
        response,
        path === "/v1/talk" ? 40 * 1024 * 1024 : path === "/v2/speech" ? 32 * 1024 * 1024 : 1024 * 1024,
      );
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if(path==='/v1/talk'||path==='/v2/speech') {
        if(signal?.aborted)throw new ExternalServiceError('BUDDY_CANCELLED','Speech was cancelled.');
        const name=(error as {name?:string})?.name;
        if(name==='TimeoutError'||name==='AbortError')
          throw new ExternalServiceError('AI_TRANSPORT_TIMEOUT','Local speech preparation or synthesis timed out. Your approved answer is retained. Retry speech.');
        if(error instanceof TypeError)
          throw new ExternalServiceError('AI_TRANSPORT_CONNECTION_FAILED','Cannot connect to the local speech service. Check that Echo is running.');
        throw new ExternalServiceError('AI_TRANSPORT_INVALID_RESPONSE','The local speech service returned an unavailable or invalid response. Your approved answer is retained.');
      }
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
  private preparationPending?:Promise<import('@echo/contracts').ModelPreparation|undefined>;
  private preparationCache:{until:number;value?:import('@echo/contracts').ModelPreparation}={until:0};
  async preparationStatus(){
    if(Date.now()<this.preparationCache.until)return this.preparationCache.value;
    if(this.preparationPending)return this.preparationPending;
    this.preparationPending=(async()=>{
      try{
        const response=await fetch(this.url.replace(/\/$/,'')+'/v2/preparation',{
          redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+this.token},signal:AbortSignal.timeout(2000),
        });
        if(!response.ok)throw Error();
        const result=z.object({preparation:modelPreparationSchema.nullable()}).strict().parse(await this.readResponse(response,8192));
        this.preparationCache={until:Date.now()+500,value:result.preparation??undefined};
        return this.preparationCache.value;
      }catch{this.preparationCache={until:Date.now()+500};return undefined;}
      finally{this.preparationPending=undefined;}
    })();
    return this.preparationPending;
  }
  private busyCache = { until: 0, value: false };
  private busyPending?: Promise<boolean>;
  async talkBusy(force = false): Promise<boolean> {
    if (!force && Date.now() < this.busyCache.until) return this.busyCache.value;
    if (this.busyPending) return this.busyPending;
    this.busyPending = (async () => {
      try {
        const r = await fetch(this.url.replace(/\/$/, "") + "/v2/runtime", {
          redirect: "error",
          cache: "no-store",
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
  async classify(text: string, owner?:string) {
    return z
      .object({ suicidal_language_flag: z.boolean() })
      .parse(await this.request("/v2/classify", { text, language: "unknown", ...(owner?{owner}:{}) }));
  }
  async analyze(text: string, owner?:string) {
    try {
      return z
        .union([journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema])
        .parse(await this.request("/v2/analyze", { text, language: "unknown", ...(owner?{owner}:{}) }));
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError("AI_UNAVAILABLE", "Local analysis is temporarily unavailable.");
    }
  }
  async chat(messages: ChatTurn[]) {
    try {
      const value = responseSchema.parse(await this.request("/v2/chat", { messages }));
      if (!value.supportRequired && !value.reply) throw new Error();
      return value;
    } catch (error) {
      if (error instanceof ExternalServiceError && (error.code.startsWith("BUDDY_")||error.code.startsWith("NATIVE_"))) throw error;
      throw new ExternalServiceError("AI_UNAVAILABLE", "Buddy is temporarily unavailable. Please try again later.");
    }
  }
  async journalRuntime(action:'prepare'|'owners'|'unload',owners:string[],faceOwners:string[]=[]){return this.request('/v2/journal-runtime',{action,owners,faceOwners});}
  async ready(): Promise<boolean> {
    try {
      return (
        await fetch(`${this.url.replace(/\/$/, "")}/ready`, {
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        })
      ).ok;
    } catch {
      return false;
    }
  }
}
