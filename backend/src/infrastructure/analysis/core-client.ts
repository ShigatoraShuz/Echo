import { modelPreparationSchema, facialExpressionResultSchema } from "@echo/contracts";
import { z } from "zod";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema } from "@echo/contracts";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import {randomUUID} from 'node:crypto';
import {setTimeout as retryDelay} from 'node:timers/promises';

/** Transport includes cold-loading retries; workers separately bound ordinary inference. */
export function coreRequestTimeout(path:string,body:unknown){
 const task=(body as {task?:unknown}|null)?.task;
 if(path==='/v1/talk'&&task==='pulse')return 5000;
 if(path==='/v2/journal-runtime'&&(body as {action?:string})?.action==='prepare')return 2_034_000;
 if(path==='/v2/analyze'||path==='/v2/chat')return 6_600_000;
 if(path==='/v2/classify')return 1_317_000;
 if(path==='/v3/screening')return 3_417_000;
 return path==='/v1/talk'&&['warm','warm_chat','warm_nano','warm_whisper','prepare','chat','support_check'].includes(String(task))?6_600_000:path==='/v1/talk'?600_000:300_000;
}
export type ChatTurn = { role: "user" | "assistant"; content: string };
const responseSchema = z.object({
  reply: z.string().min(1).max(12000).nullable(),
  supportRequired: z.boolean(),
  model: z.record(z.string(), z.unknown()).optional(),
  quality: z.record(z.string(), z.unknown()).optional(),
});
const talkIssueCodes = new Set('empty hard_token_limit persistent_distress_support_missing generic_advice_without_starting_action stock_reassurance stacked_generic_advice dangling_list_or_clause unfinished_structure_or_clause excessive_questions_4plus extreme_response_length extreme_structural_overload persistent_advice_without_concrete_start requested_step_list_missing requested_step_count_mismatch nonconsecutive_step_numbering excessive_step_count incomplete_list_item duplicate_list_item near_verbatim_user_copy malformed_discourse_transition auto_format_failed rewrite_context_modified_or_invalid potential_safety_language_requires_Echo_support_routing unqualified_give_up_requires_human_safety_review'.split(' '));
function talkDiagnostics(value: unknown) {
  const raw = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  const codes=(items:unknown)=>Array.isArray(items)?[...new Set(items.filter((item):item is string=>typeof item==='string'&&talkIssueCodes.has(item)))]:[];
  return {blockingIssues:codes(raw.blockingIssues),advisoryIssues:codes(raw.advisoryIssues),
    attempts:typeof raw.attempts==='number'&&Number.isInteger(raw.attempts)&&raw.attempts>=0&&raw.attempts<=2?raw.attempts:0,
    attemptDiagnostics:Array.isArray(raw.attemptDiagnostics)?raw.attemptDiagnostics.slice(0,2).map(row=>{
      const item=row&&typeof row==='object'?row as Record<string,unknown>:{};
      return {blockingIssues:codes(item.blockingIssues),advisoryIssues:codes(item.advisoryIssues)};
    }):[]};
}
function normalizeTalkResponse(value: unknown): z.infer<typeof responseSchema> {
  if (!value || typeof value !== "object") throw new Error("Invalid Buddy talk response");
  const raw = value as Record<string, unknown>;
  const candidate = [raw.reply, raw.text, raw.response, raw.content].find((entry) => typeof entry === "string") as string | undefined;
  const support = raw.supportRequired;
  const supportRequired = typeof support === "boolean" ? support : support === "true" ? true : support === "false" ? false : undefined;
  if (supportRequired === undefined) throw new Error("Buddy talk safety result was ambiguous");
  return responseSchema.parse({ reply: candidate?.trim() || null, supportRequired, model: raw.model, quality: raw.quality });
}
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
    const started=performance.now();
    const correlationId=randomUUID();
    let httpStatus:number|undefined;
    try {
      const encoded = JSON.stringify(body);
      const limit =
        path === "/v2/speech" || path === '/v1/dictation'
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
      httpStatus=response.status;
      if (!response.ok) {
        if ([401,403].includes(response.status))
          throw new ExternalServiceError('AI_TRANSPORT_AUTH_FAILED','The private AI service rejected its connection credential. Restart Echo using one coordinated launcher.');
        if (response.status===429)
          throw new ExternalServiceError('AI_TRANSPORT_RATE_LIMITED','The local AI service is receiving too many requests. Wait briefly, then retry speech.');
        if (response.status === 503) {
          const value = (await this.readResponse(response).catch(() => null)) as { detail?: { code?: string; diagnostics?: unknown } } | null;
          const code = value?.detail?.code;
          if ((path==='/v1/talk'||path==='/v2/chat') && code==='BUDDY_RESPONSE_WITHHELD') {
            const diagnostics=talkDiagnostics(value?.detail?.diagnostics);
            console.warn(JSON.stringify({service:'private-ai',operation:'chat',correlationId,
              code,deliveryMode:path==='/v2/chat'?'chat':'voice',generationAttempt:(body as {generationAttempt?:number}).generationAttempt,...diagnostics}));
            throw Object.assign(new ExternalServiceError(code,'Buddy could not approve a complete reply. Please try again.'),
              {safetyWithheld:diagnostics.blockingIssues.some(issue=>issue==='potential_safety_language_requires_Echo_support_routing'||issue==='unqualified_give_up_requires_human_safety_review')});
          }
          if (typeof code === "string" && (/^(BUDDY|FACE|NATIVE)_[A-Z_]{1,70}$/.test(code)||/^BUDDY_MOSS_NATIVE_EXIT_[A-F0-9]{8}$/.test(code)))
            throw new ExternalServiceError(
              code,
              code === "BUDDY_CBT_ENV_ACCESS_DENIED"
                ? "Windows denied access to Thesis2_VENV. Restore access before starting Buddy."
                : code === "BUDDY_RESPONSE_WITHHELD"
                  ? "Buddy could not approve a complete reply. Please try again."
                  : code.startsWith('NATIVE_') ? (path==='/v1/talk'?'Buddy safety screening failed: ':'Journal model loading failed: ')+code
                  : "Buddy model readiness or inference failed: " + code,
            );
          if (value?.detail?.code === "TALK_BUSY")
            throw new ExternalServiceError("TALK_BUSY", "Journal inference is waiting while Talk is active.");
        }
        if(path==='/v1/talk'||path==='/v2/speech') {
          const code=[400,413,422].includes(response.status)?'BUDDY_SPEECH_REQUEST_INVALID':response.status===404?'BUDDY_SPEECH_ENDPOINT_MISSING':'AI_TRANSPORT_UNAVAILABLE';
          throw new ExternalServiceError(code,'Speech preparation could not finish. Your approved answer is retained.');
        }
        throw new Error();
      }
      return await this.readResponse(
        response,
        path === "/v1/talk" ? 40 * 1024 * 1024 : path === "/v2/speech" ? 32 * 1024 * 1024 : 1024 * 1024,
      );
    } catch (error) {
      const operation=path==='/v1/talk'?String((body as {task?:unknown})?.task??'unknown'):path==='/v2/chat'?'chat':'transport';
      const code=(error as {code?:string})?.code;
      console.warn(JSON.stringify({service:'private-ai',operation:['pulse','warm','warm_chat','warm_nano','warm_whisper','speak','transcribe','chat','support_check','prepare','close','unload'].includes(operation)?operation:'transport',
        correlationId,sessionId:typeof (body as {sessionId?:unknown})?.sessionId==='string'&&/^[a-f0-9-]{36}$/.test((body as {sessionId:string}).sessionId)?(body as {sessionId:string}).sessionId:undefined,
        elapsedMs:Math.round(performance.now()-started),deadlineMs:coreRequestTimeout(path,body),httpStatus,
        cancellationSource:signal?.aborted?'caller':(error as {name?:string})?.name==='TimeoutError'?'deadline':'transport',
        code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:'AI_TRANSPORT_FAILED'}));
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
  async dictation(payload:{task:'warm_whisper'|'transcribe'|'close';sessionId:string;audio?:string},signal?:AbortSignal){
    return z.object({text:z.string().max(4000).optional(),model:z.record(z.string(),z.unknown()).optional()}).passthrough().parse(await this.request('/v1/dictation',payload,signal));
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
    if (payload.task === "chat") return normalizeTalkResponse(value);
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
  private journalPreparationPending?:Promise<import('@echo/contracts').ModelPreparation|undefined>;
  private journalPreparationCache:{until:number;value?:import('@echo/contracts').ModelPreparation}={until:0};
  async journalPreparationStatus(){
    if(Date.now()<this.journalPreparationCache.until)return this.journalPreparationCache.value;
    if(this.journalPreparationPending)return this.journalPreparationPending;
    this.journalPreparationPending=(async()=>{
      try{
        const response=await fetch(this.url.replace(/\/$/,'')+'/v2/journal-preparation',{
          redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+this.token},signal:AbortSignal.timeout(2000),
        });
        if(!response.ok)throw Error();
        const result=z.object({preparation:modelPreparationSchema.nullable()}).strict().parse(await this.readResponse(response,8192));
        this.journalPreparationCache={until:Date.now()+500,value:result.preparation??undefined};
        return this.journalPreparationCache.value;
      }catch{this.journalPreparationCache={until:Date.now()+500};return undefined;}
      finally{this.journalPreparationPending=undefined;}
    })();
    return this.journalPreparationPending;
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
        const status=await r.json() as {talkBusy?:boolean;talkActive?:boolean};
        const value = status.talkBusy ?? Boolean(status.talkActive);
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
  async runtimeActivity():Promise<{journalBusy:boolean;talkReady:boolean}>{
    const response=await fetch(this.url.replace(/\/$/,'')+'/v2/runtime',{redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+this.token},signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error('Runtime activity unavailable');
    const status=await response.json() as {journalBusy?:boolean;talkReady?:boolean};return {journalBusy:status.journalBusy===true,talkReady:status.talkReady!==false};
  }
  async screening(text: string) {
    return await this.request("/v3/screening", { text });
  }
  async classify(text: string, owner?:string, signal?:AbortSignal) {
    return z
      .object({ suicidal_language_flag: z.boolean() })
      .passthrough()
      .parse(await this.request("/v2/classify", { text, language: "unknown", ...(owner?{owner}:{}) },signal));
  }
  async analyze(text: string, owner?:string,signal?:AbortSignal,classification?:Record<string,unknown>) {
    try {
      return z
        .union([journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema])
        .parse(await this.request("/v2/analyze", { text, language: "unknown", ...(owner?{owner}:{}),...(classification?{classification}:{}) },signal));
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError("AI_UNAVAILABLE", "Local analysis is temporarily unavailable.");
    }
  }
  async chat(messages: ChatTurn[], signal?:AbortSignal) {
    for(let generationAttempt=1;generationAttempt<=5;generationAttempt++){
      if(signal?.aborted)throw new ExternalServiceError('BUDDY_CANCELLED','Buddy generation was cancelled.');
      try {
        const value=normalizeTalkResponse(await this.request('/v2/chat',{messages,generationAttempt},signal));
        if(!value.supportRequired&&!value.reply)throw new Error();
        return value;
      } catch(error) {
        if(signal?.aborted)throw new ExternalServiceError('BUDDY_CANCELLED','Buddy generation was cancelled.');
        const code=(error as {code?:string}).code??'';
        const retryable=['BUDDY_RESPONSE_WITHHELD','AI_TRANSPORT_TIMEOUT','AI_TRANSPORT_UNAVAILABLE','AI_TRANSPORT_RATE_LIMITED','TALK_BUSY'].includes(code);
        if(generationAttempt<5&&retryable&&!(error as {safetyWithheld?:boolean}).safetyWithheld){
          try {await retryDelay(250*generationAttempt,undefined,{signal});}
          catch {throw new ExternalServiceError('BUDDY_CANCELLED','Buddy generation was cancelled.');}
          continue;
        }
        if(error instanceof ExternalServiceError)throw error;
        throw new ExternalServiceError('AI_UNAVAILABLE','Buddy is temporarily unavailable. Please try again later.');
      }
    }
    throw new ExternalServiceError('AI_UNAVAILABLE','Buddy is temporarily unavailable. Please try again later.');
  }
  async journalRuntime(action:'prepare'|'owners'|'unload',owners:string[],faceOwners:string[]=[],signal?:AbortSignal){return this.request('/v2/journal-runtime',{action,owners,faceOwners},signal);}
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
