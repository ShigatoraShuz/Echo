import { sealAnalysisResult, openAnalysisResult } from "../../infrastructure/encryption/analysis-result-encryption.js";
import { assertAiEnabled } from "../../infrastructure/security/runtime-controls.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertTrustedContact } from "../settings/trusted-contact-access.js";
import { JournalImagesService } from "./journal-images.service.js";
import {
  analysisChecksFor,
  analysisFixtureSchema,
  facialAnalysisStatusSchema,
  journalAnalysisResultSchema,
  journalScreeningSchema,
  type AnalysisFixture,
  type AnalysisInsightRange,
  type FaceMeshCapture,
  type FacialAnalysisStatus,
  type AnalysisMode,
  type AnalysisStatus,
  type JournalAnalysisResult,
  type JournalSubmissionResponse,
} from "@echo/contracts";
import {
  AppError,
  AuthorizationError,
  AnalysisGateError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { EncryptionService, EncryptedPayload } from "../../infrastructure/encryption/encryption.service.js";
import type { AiAnalysisProvider } from "../../infrastructure/analysis/analysis-provider.types.js";
import {
  DisabledFacialAnalysisProvider,
  type FacialAnalysisProvider,
} from "../../infrastructure/analysis/facial-analysis-provider.types.js";
import { DevelopmentAnalysisRunner } from "../../infrastructure/analysis/development-analysis.runner.js";
import { analysisProgressFor, assertAnalysisTransition } from "../../infrastructure/analysis/analysis-state-machine.js";
import type { IdempotencyIdentity, IdempotencyService } from "../../infrastructure/idempotency/idempotency.service.js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";
import { LocalAnalysisStore, type LocalAnalysisJob } from "../../infrastructure/analysis/local-analysis-store.js";
import type { CoreClient } from "../../infrastructure/analysis/core-client.js";

export interface JournalInput {
  title: string;
  body: string;
  mood: "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";
  emotions: string[];
  tags: string[];
  privacyStatus: "private" | "shared";
  analysisConsent: boolean;
  facialAnalysisRequested: boolean;
  facialCapture?: FaceMeshCapture;
}

export interface JournalResponse {
  images?: Array<{id:string;url:string}>;
  id: string;
  title: string;
  body: string;
  excerpt: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
  risk_score: number | null;
  risk_band: "low" | "mild" | "moderate" | "high" | "severe" | null;
  summary: string;
  perspective: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResponse {
  id: string;
  entry_id: string;
  summary: string;
  perspective: string;
  mood_insight: string;
  risk_indication: string;
  is_demo_data: boolean;
  created_at: string;
  status: string;
  phq8_score: number | null;
  severity: string | null;
  urgent_language_detected: boolean;
  provider: string;
  facial_status: FacialAnalysisStatus;
  result?: JournalAnalysisResult;
}

export type JournalSubmissionResult =
  | { kind: "private"; journalId: string; replayed: boolean }
  | { kind: "analysis"; submission: JournalSubmissionResponse; replayed: boolean };

export interface JournalAnalysisRuntime {
  mode: AnalysisMode;
  developmentUserIds: Set<string>;
  timeoutMs: number;
  isProduction?: boolean;
}

export interface JournalDraftInput {
  submissionKey?: string;
  title: string;
  body: string;
  mood: JournalInput["mood"];
  emotions: string[];
  tags: string[];
  privacyStatus: JournalInput["privacyStatus"];
  analysisConsent: boolean;
}

export interface JournalDraftResponse {
  submission_key?: string;
  id: string;
  title: string;
  body: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
  updated_at: string;
}

type JournalRow = Record<string, unknown>;
type AnalysisRow = Record<string, unknown>;

interface AnalysisInsightsRangeInput {
  range: AnalysisInsightRange;
  from?: string;
  to?: string;
}

function bytea(value: string): string {
  return `\\x${Buffer.from(value, "base64").toString("hex")}`;
}

function base64FromBytea(value: unknown): string {
  if (typeof value !== "string") throw new Error("Encrypted journal data is invalid.");
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function riskBand(severity: unknown): JournalResponse["risk_band"] {
  if (severity === "minimal" || severity === "low" || severity === "none") return "low";
  if (severity === "mild") return "mild";
  if (severity === "moderate") return "moderate";
  if (severity === "moderately_severe") return "high";
  if (severity === "severe") return "severe";
  return null;
}

function databaseError(error: unknown, operation: SupabaseOperation, message: string): ExternalServiceError {
  if (error) logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

export class JournalService {
  private readonly localActive = new Set<string>();
  private localTail: Promise<void> = Promise.resolve();
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly analysisProvider: AiAnalysisProvider,
    private readonly idempotency?: IdempotencyService,
    private readonly runtime: JournalAnalysisRuntime = {
      mode: "disabled",
      developmentUserIds: new Set(),
      timeoutMs: 60_000,
    },
    private readonly runner = new DevelopmentAnalysisRunner(1),
    private readonly facialAnalysisProvider: FacialAnalysisProvider = new DisabledFacialAnalysisProvider(),
    private readonly userDatabase?: () => SupabaseClient,
    readonly localResults?: LocalAnalysisStore,
    private readonly coreClient?: CoreClient,
  ) {}

  private localRow(job:LocalAnalysisJob):AnalysisRow {
    return {id:job.id,journal_id:job.journal_id,user_id:job.user_id,status:job.status,created_at:job.created_at,
      result_payload:job.result_ciphertext?{ciphertext:job.result_ciphertext}:null,severity:null,phq8_score:null,
      facial_status:job.facial_status};
  }
  async recoverLocalJobs():Promise<void> {
    if(!this.localResults || !this.coreClient || !await this.coreClient.ready())return;
    for(const job of this.localResults.pending())this.enqueueLocal(job);
  }
  private enqueueLocal(job:LocalAnalysisJob){
    if(this.localActive.has(job.id))return;
    this.localActive.add(job.id);
    this.localTail=this.localTail.then(()=>this.processLocal(job)).catch(()=>{}).finally(()=>this.localActive.delete(job.id));
  }
  private async processLocal(job:LocalAnalysisJob){
    const store=this.localResults!;
    if(!store.get(job.user_id,job.id))return;
    if(!this.coreClient || !await this.coreClient.ready()){store.set(job.user_id,job.id,'waiting_for_provider',job.progress);return;}
    try {
      if(!await this.hasGlobalAnalysisConsent(job.user_id))throw new AnalysisGateError('Journal-analysis consent is required.');
      await this.assertAnalysisGates(job.user_id);
      const entry=await this.get(job.user_id,job.journal_id);
      store.set(job.user_id,job.id,'safety_checking',10);
      const classification=await this.coreClient.classify(entry.body);
      if(!store.get(job.user_id,job.id))return;
      if(!job.approved && (classification.suicidal_language_flag || /\b(kill myself|end my life|hurt myself|want to die)\b/i.test(entry.body))){
        store.set(job.user_id,job.id,'safety_action_required',10);return;
      }
      await this.assertAnalysisGates(job.user_id);
      if(!await this.hasGlobalAnalysisConsent(job.user_id))throw new AnalysisGateError('Journal-analysis consent was revoked.');
      store.set(job.user_id,job.id,'analyzing_emotions',25);
      const result=await this.coreClient.analyze(entry.body);
      if(!store.get(job.user_id,job.id))return;
      const current=await this.get(job.user_id,job.journal_id);
      if(current.body!==entry.body)throw new ConflictError('JOURNAL_CHANGED','The reflection changed during local analysis.');
      await this.assertAnalysisGates(job.user_id);
      if(!await this.hasGlobalAnalysisConsent(job.user_id))throw new AnalysisGateError('Journal-analysis consent was revoked.');
      store.set(job.user_id,job.id,'completed',100,JSON.stringify(result));
    } catch {
      store.set(job.user_id,job.id,'failed',job.progress);
    }
  }
  private async createLocal(userId:string,input:JournalInput,key:string|undefined,fixture?:string):Promise<JournalSubmissionResult>{
    if(fixture)throw new ValidationError({fixture:['Development fixtures are not available for local model results.']});
    if(!this.idempotency)throw new ExternalServiceError('IDEMPOTENCY_UNAVAILABLE','Secure submission is not configured.');
    const identity=this.idempotency.identify(key,{...input,analysisConsent:true,fixture:null});
    const replay=this.localResults!.replay(userId,identity.keyHmac,identity.requestHash);
    if(replay){
      await this.get(userId,replay.journal_id);
      return {kind:'analysis',submission:{storage:'local_json',journalId:replay.journal_id,analysisJobId:replay.id,status:replay.status==='waiting_for_provider'?'waiting_for_provider':'queued',facialStatus:replay.facial_status},replayed:true};
    }
    if(!await this.hasGlobalAnalysisConsent(userId))throw new AnalysisGateError('Enable journal-analysis consent or save without analysis.','global_consent');
    await this.assertAnalysisGates(userId);
    // Supabase receives only an ordinary encrypted journal save. Never request its AI workflow.
    const saved=await this.create(userId,{...input,analysisConsent:false,facialAnalysisRequested:false,facialCapture:undefined},key,undefined,true);
    if(saved.kind!=='private')throw new Error('Local save entered a remote AI workflow.');
    const facial:FacialAnalysisStatus=input.facialAnalysisRequested?(input.facialCapture?'captured_pending_provider':'not_captured'):'not_requested';
    let job:LocalAnalysisJob;
    try {job=this.localResults!.create(userId,saved.journalId,identity.keyHmac,identity.requestHash,facial);}
    catch(error){if(error instanceof AppError)throw error;throw new ExternalServiceError('LOCAL_RESULTS_UNAVAILABLE','Your reflection is saved, but local analysis could not be queued. Check local storage and retry saving.');}
    this.enqueueLocal(job);
    return {kind:'analysis',submission:{storage:'local_json',journalId:job.journal_id,analysisJobId:job.id,status:'queued',facialStatus:facial},replayed:saved.replayed};
  }
  private localRecommendation(job:LocalAnalysisJob){
    const result=this.readAnalysisResult({ciphertext:job.result_ciphertext});
    const activity=result.recommendationFeatures[0];
    const titles:Record<string,string>={paced_breathing:'Take a gentle breathing pause',grounding:'Try a grounding activity',behavioral_activation:'Choose one small activity',thought_reframing:'Explore a different perspective',support_connection:'Explore support options'};
    return {id:job.id,title:titles[activity]??'A gentle next step',description:'An optional activity selected by application rules.',activity};
  }
  private async localDashboard(userId:string,input:AnalysisInsightsRangeInput){
    const now=new Date(),to=input.to?new Date(`${input.to}T23:59:59.999Z`):now;
    const days=input.range==='7d'?7:input.range==='90d'?90:30;
    const from=input.from?new Date(`${input.from}T00:00:00.000Z`):new Date(to.getTime()-(days-1)*86400000);
    const rows=this.localResults!.completed(userId).filter(x=>x.created_at>=from.toISOString()&&x.created_at<=to.toISOString());
    let visible=rows;
    if(rows.length){
      const {data,error}=await this.reader.schema('journal_service').from('journals').select('id').eq('user_id',userId).in('id',rows.map(x=>x.journal_id)).is('deleted_at',null);
      if(error)throw new ExternalServiceError('DATABASE_UNAVAILABLE','Journal ownership could not be checked.');
      const ids=new Set((data??[]).map(x=>x.id));visible=rows.filter(x=>ids.has(x.journal_id));
      for(const row of rows)if(!ids.has(row.journal_id))this.localResults!.remove(userId,row.journal_id);
    }
    const latest=visible.at(-1);
    return {latestResultId:latest?.id??null,latest:latest?this.readAnalysisResult({ciphertext:latest.result_ciphertext}):null,
      recommendation:latest?this.localRecommendation(latest):null,
      emotionTrend:[...new Map(visible.map(x=>[x.created_at.slice(0,10),x])).values()].map(row=>{const result=this.readAnalysisResult({ciphertext:row.result_ciphertext});return {date:row.created_at.slice(0,10),values:Object.fromEntries(result.emotionDistribution.map(x=>[x.emotion,x.value])),isSimulated:result.isSimulated,schemaVersion:result.schemaVersion};}),
      journalScreeningTrend:visible.flatMap(row=>{const r=this.readAnalysisResult({ciphertext:row.result_ciphertext});return r.schemaVersion==='echo-journal-analysis-v3'?[{date:row.created_at.slice(0,10),status:r.journalScreening.status,coverage:r.journalScreening.coverage,subtotal:r.journalScreening.subtotal,total:r.journalScreening.total}]:[];}),
      distressTrend:[],facialStatus:latest?.facial_status??'not_requested',period:{range:input.range,from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10),analyzedReflectionCount:visible.length}};
  }

  private get reader(): SupabaseClient { return this.userDatabase?.() ?? this.database; }

  encryptAnalysisResult(value: unknown) { return sealAnalysisResult(value, this.encryption); }

  private readAnalysisResult(value: unknown) { if(this.localResults && value && typeof value === "object" && "ciphertext" in value)return journalAnalysisResultSchema.parse(JSON.parse(String(value.ciphertext)));
    return openAnalysisResult(value, this.encryption); }

  private async hasGlobalFacialConsent(userId: string): Promise<boolean> {
    const { data, error } = await this.database
      .schema("user_service")
      .from("privacy_preferences")
      .select("facial_analysis_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Facial-analysis consent could not be checked.");
    return (data as Record<string, unknown> | null)?.facial_analysis_enabled === true;
  }

  private async recordFacialMetadata(
    userId: string,
    journalId: string,
    jobId: string,
    requested: boolean,
    capture?: FaceMeshCapture,
  ): Promise<FacialAnalysisStatus> {
    if (!requested) return "not_requested";
    const facialStatus = await this.facialAnalysisProvider.submit({ userId, journalId, analysisJobId: jobId, capture });
    const metadata = {
      facial_analysis_requested: true,
      facial_status: facialStatus,
      facial_capture_received_at: capture?.capturedAt ?? null,
      facial_capture_schema_version: capture?.schemaVersion ?? null,
      facial_capture_model_version: capture?.modelVersion ?? null,
    };
    const [{ error: requestError }, { error: projectionError }] = await Promise.all([
      this.database.schema("ai_analysis").from("analysis_requests").update(metadata).eq("id", jobId).eq("user_id", userId),
      this.database.schema("public").from("analysis_status_projection").update({ facial_status: facialStatus }).eq("job_id", jobId).eq("user_id", userId),
    ]);
    if (requestError || projectionError) {
      throw databaseError(
        requestError ?? projectionError,
        { module: "journals", schema: "ai_analysis", table: "analysis_requests", operation: "record facial capture metadata" },
        "Facial capture status could not be recorded.",
      );
    }
    return facialStatus;
  }

  private encryptJournal(input: { title: string; body: string }): EncryptedPayload {
    return this.encryption.encrypt(JSON.stringify({ title: input.title, body: input.body }));
  }

  private decryptJournal(row: JournalRow): { title: string; body: string } {
    if (!row.content_ciphertext || !row.encryption_iv || !row.encryption_auth_tag || !row.encryption_key_version) {
      throw new Error("This legacy journal cannot be read by the encrypted journal workflow.");
    }
    const plaintext = this.encryption.decrypt({
      ciphertext: base64FromBytea(row.content_ciphertext),
      iv: base64FromBytea(row.encryption_iv),
      authenticationTag: base64FromBytea(row.encryption_auth_tag),
      keyVersion: Number(row.encryption_key_version),
    });
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== "object") throw new Error("Encrypted journal data is invalid.");
    const record = parsed as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.body !== "string") {
      throw new Error("Encrypted journal data is invalid.");
    }
    return { title: record.title, body: record.body };
  }

  private async latestAnalysis(journalId: string, userId: string): Promise<AnalysisRow | null> {
    if(this.localResults){const job=this.localResults.journal(userId,journalId);return job?.result_ciphertext?this.localRow(job):null;}
    const { data, error } = await this.database
      .schema("ai_analysis")
      .from("analysis_results")
      .select("*,analysis_requests!inner(journal_id,deleted_at)")
      .eq("analysis_requests.journal_id", journalId)
      .is("analysis_requests.deleted_at", null)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    return (data as AnalysisRow | null) ?? null;
  }

  private toJournalResponse(row: JournalRow, analysis: AnalysisRow | null): JournalResponse {
    const journal = this.decryptJournal(row);
    const structured = analysis?.result_payload ? this.readAnalysisResult(analysis.result_payload) : null;
    const score = structured?.depressiveSymptomRange ? Math.round((structured.depressiveSymptomRange.lower + structured.depressiveSymptomRange.upper) / 2) : null;
    const severity = analysis?.severity;
    return {
      id: asString(row.id),
      title: journal.title,
      body: journal.body,
      excerpt: journal.body.slice(0, 180),
      mood: asString(row.mood, "neutral"),
      emotions: asStringArray(row.emotions),
      tags: asStringArray(row.tags),
      privacy_status: asString(row.privacy_status, "private"),
      analysis_consent: this.localResults ? Boolean(this.localResults.journal(asString(row.user_id),asString(row.id))) : row.analysis_consent === true,
      risk_score: score !== null ? Math.round((score / 24) * 100) : null,
      risk_band: analysis && structured?.schemaVersion === "echo-journal-analysis-v1" ? riskBand(severity) : null,
      summary: analysis
        ? `${analysis.is_simulated ? "Simulated analysis" : "Analysis"} is available. It is not a clinical assessment.`
        : "No analysis result is available.",
      perspective: analysis ? "This estimate is not a diagnosis or completed PHQ-8 assessment." : null,
      created_at: asString(row.created_at),
      updated_at: asString(row.updated_at),
    };
  }

  async listPage(userId: string, options: {
    page: number; pageSize: number; query: string; mood?: JournalInput["mood"];
    dateFrom?: string; dateTo?: string; sort: "newest" | "oldest";
  }): Promise<{ entries: JournalResponse[]; total: number; page: number; page_size: number }> {
    const start = (options.page - 1) * options.pageSize;
    const base = () => {
      let query = this.reader.schema("journal_service").from("journals")
        .select("*", { count: "exact" }).eq("user_id", userId).is("deleted_at", null);
      if (options.mood) query = query.eq("mood", options.mood);
      if (options.dateFrom) query = query.gte("created_at", `${options.dateFrom}T00:00:00.000Z`);
      if (options.dateTo) query = query.lt("created_at", new Date(Date.parse(`${options.dateTo}T00:00:00.000Z`) + 86_400_000).toISOString());
      return query.order("created_at", { ascending: options.sort === "oldest" }).order("id", { ascending: options.sort === "oldest" });
    };
    let rows: JournalRow[] = [];
    let total = 0;
    if (options.query) {
      const needle = options.query.toLocaleLowerCase();
      const matches: JournalRow[] = [];
      // shortcut: encrypted search scans owner-scoped rows; add a privacy-reviewed index if per-user volume makes this slow.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await base().range(offset, offset + 499);
        if (error) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journals", operation: "search journals" }, "The journal service is temporarily unavailable.");
        const batch = (data ?? []) as JournalRow[];
        for (const row of batch) {
          const { title, body } = this.decryptJournal(row);
          if (`${title}\n${body}\n${asStringArray(row.tags).join("\n")}`.toLocaleLowerCase().includes(needle)) matches.push(row);
        }
        if (batch.length < 500) break;
      }
      total = matches.length;
      rows = matches.slice(start, start + options.pageSize);
    } else {
      const { data, count, error } = await base().range(start, start + options.pageSize - 1);
      if (error) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journals", operation: "list journals" }, "The journal service is temporarily unavailable.");
      rows = (data ?? []) as JournalRow[];
      total = count ?? 0;
    }
    const ids = rows.map((row) => asString(row.id));
    if (ids.length === 0) return { entries: [], total, page: options.page, page_size: options.pageSize };
    const [analysisResult, images] = await Promise.all([
      this.localResults ? Promise.resolve({data:ids.flatMap(id=>{const job=this.localResults!.journal(userId,id);return job?.result_ciphertext?[{...this.localRow(job),analysis_requests:{journal_id:id}}]:[];}),error:null}) : this.database.schema("ai_analysis").from("analysis_results")
        .select("*,analysis_requests!inner(journal_id,deleted_at)")
        .eq("user_id", userId).is("analysis_requests.deleted_at", null)
        .in("analysis_requests.journal_id", ids).order("created_at", { ascending: false }),
      new JournalImagesService(this.database).listForJournals(userId, ids),
    ]);
    if (analysisResult.error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Journal analysis could not be loaded.");
    const analyses = new Map<string, AnalysisRow>();
    for (const analysis of (analysisResult.data ?? []) as AnalysisRow[]) {
      const request = analysis.analysis_requests as Record<string, unknown> | undefined;
      const id = asString(request?.journal_id);
      if (id && !analyses.has(id)) analyses.set(id, analysis);
    }
    return {
      entries: rows.map((row) => {
        const id = asString(row.id);
        return { ...this.toJournalResponse(row, analyses.get(id) ?? null), images: images.get(id) ?? [] };
      }),
      total, page: options.page, page_size: options.pageSize,
    };
  }

  async listSummaries(userId: string): Promise<Array<{
    id: string; mood: string; emotions: string[]; tags: string[]; created_at: string;
  }>> {
    const summaries = [] as Array<{ id: string; mood: string; emotions: string[]; tags: string[]; created_at: string }>;
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.reader.schema("journal_service").from("journals")
        .select("id,mood,emotions,tags,created_at")
        .eq("user_id", userId).is("deleted_at", null)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      if (error) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journals", operation: "list journal summaries" }, "The journal service is temporarily unavailable.");
      const batch = (data ?? []) as JournalRow[];
      summaries.push(...batch.map((row) => ({
        id: asString(row.id),
        mood: asString(row.mood, "neutral"), emotions: asStringArray(row.emotions),
        tags: asStringArray(row.tags), created_at: asString(row.created_at),
      })));
      if (batch.length < 500) break;
    }
    return summaries;
  }

  async get(userId: string, journalId: string): Promise<JournalResponse> {
    const { data, error } = await this.reader
      .schema("journal_service")
      .from("journals")
      .select("*")
      .eq("id", journalId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    if (!data) throw new NotFoundError("The journal entry was not found.");
    const row = data as JournalRow;
    const [analysis, images] = await Promise.all([
      this.latestAnalysis(journalId, userId),
      new JournalImagesService(this.database).list(userId, journalId),
    ]);
    return { ...this.toJournalResponse(row, analysis), images };
  }

  async uploadImage(userId:string,journalId:string,imageId:string,bytes:Buffer,mime:string) {
    return new JournalImagesService(this.database).upload(userId,journalId,imageId,bytes,mime);
  }

  async uploadDraftImage(userId:string,imageId:string,bytes:Buffer,mime:string) {
    return new JournalImagesService(this.database).uploadDraft(userId,imageId,bytes,mime);
  }

  async listDraftImages(userId:string) {
    return new JournalImagesService(this.database).listDraft(userId);
  }

  async removeDraftImage(userId:string,imageId:string) {
    return new JournalImagesService(this.database).removeDraft(userId,imageId);
  }

  async attachDraftImages(userId:string,journalId:string) {
    return new JournalImagesService(this.database).attachDraft(userId,journalId);
  }

  async getJournalTitles(userId: string, journalIds: string[]): Promise<Map<string, string>> {
    if (journalIds.length === 0) return new Map();
    const { data, error } = await this.reader
      .schema("journal_service")
      .from("journals")
      .select("id,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("id", [...new Set(journalIds)]);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Journal notification labels could not be loaded.");
    return new Map(
      ((data ?? []) as JournalRow[]).map((row) => [asString(row.id), this.decryptJournal(row).title] as const),
    );
  }

  async create(
    userId: string,
    input: JournalInput,
    rawIdempotencyKey?: string,
    requestedFixture?: string,
    skipLocal=false,
  ): Promise<JournalSubmissionResult> {
    if(this.localResults && !skipLocal && await this.hasGlobalAnalysisConsent(userId))return this.createLocal(userId,input,rawIdempotencyKey,requestedFixture);
    if(this.localResults)input={...input,analysisConsent:false};
    if (!this.idempotency) {
      throw new ExternalServiceError("IDEMPOTENCY_UNAVAILABLE", "Secure journal submission is not configured.");
    }
    const fixture = this.authorizeFixture(userId, requestedFixture);
    if (input.facialAnalysisRequested && !(await this.hasGlobalFacialConsent(userId))) {
      throw new AnalysisGateError(
        "Enable facial expression analysis in Privacy settings, or save without face capture.",
        "global_consent",
      );
    }
    let identity = this.idempotency.identify(rawIdempotencyKey, { ...input, fixture: requestedFixture ?? null });
    const { data: recent, error: replayError } = await this.database
      .schema("ai_analysis")
      .from("idempotency_records")
      .select("key_version,key_hmac,request_hash,state,response_status,response_payload")
      .eq("user_id", userId)
      .eq("operation", "journal.create")
      .gt("expires_at", new Date().toISOString());
    if (replayError)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Journal retry information could not be checked.");
    if ((recent ?? []).some((record) => !this.idempotency!.acceptsVersion(record.key_version)))
      throw new ExternalServiceError(
        "IDEMPOTENCY_ROTATION_INCOMPLETE",
        "A previous retry verification key must remain available for the 24-hour window.",
      );
    const previous = (recent ?? []).find((record) =>
      this.idempotency?.matches(rawIdempotencyKey ?? "", record.key_version, record.key_hmac),
    );
    if (previous) {
      this.idempotency.assertSameRequest(previous.request_hash, identity.requestHash);
      identity = { keyVersion: previous.key_version, keyHmac: previous.key_hmac, requestHash: identity.requestHash };
      if (previous.state === "succeeded") {
        const stored = previous.response_payload as Record<string, unknown>;
        if (previous.response_status === 201)
          return { kind: "private", journalId: String(stored.journalId), replayed: true };
        const journalId = String(stored.journalId);
        const analysisJobId = String(stored.analysisJobId);
        const facialStatus = await this.recordFacialMetadata(
          userId,
          journalId,
          analysisJobId,
          input.facialAnalysisRequested,
          input.facialCapture,
        );
        return {
          kind: "analysis",
          submission: {
            journalId,
            analysisJobId,
            status: stored.status as "queued" | "waiting_for_provider",
            facialStatus,
          },
          replayed: true,
        };
      }
    }
    const analysisRequested = input.analysisConsent && (await this.hasGlobalAnalysisConsent(userId));
    if (input.analysisConsent && !analysisRequested) {
      await this.recordRejectedIdempotency(userId, identity, "ANALYSIS_CONSENT_REQUIRED");
      throw new AnalysisGateError(
        "Enable global journal-analysis consent, or turn analysis off to save privately.",
        "global_consent",
      );
    }
    if (analysisRequested) {
      try {
        await this.assertAnalysisGates(userId);
      } catch (error) {
        if (!(error instanceof AuthorizationError)) throw error;
        await this.recordRejectedIdempotency(userId, identity, "ANALYSIS_GATE_FAILED");
        throw new AnalysisGateError(error.message);
      }
    }
    const initialStatus = analysisRequested ? await this.initialAnalysisStatus() : "saved";
    const encrypted = this.encryptJournal(input);
    const draftKey = rawIdempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawIdempotencyKey) ? rawIdempotencyKey : null;
    const { data, error } = await this.database.schema("journal_service").rpc(draftKey ? "submit_draft_journal" : "submit_journal", {
      ...(draftKey ? { p_draft_key: draftKey } : {}),
      p_user_id: userId,
      p_title_sentinel: "[encrypted]",
      p_content_ciphertext: bytea(encrypted.ciphertext),
      p_encryption_iv: bytea(encrypted.iv),
      p_encryption_auth_tag: bytea(encrypted.authenticationTag),
      p_encryption_key_version: encrypted.keyVersion,
      p_word_count: input.body.trim() ? input.body.trim().split(/\s+/).length : 0,
      p_mood: input.mood,
      p_emotions: input.emotions,
      p_tags: input.tags,
      p_privacy_status: input.privacyStatus,
      p_analysis_requested: analysisRequested,
      p_initial_status: initialStatus,
      p_fixture: fixture,
      p_processing_mode: this.localResults ? "disabled" : this.runtime.mode,
      p_idempotency_key_version: identity.keyVersion,
      p_idempotency_hmac: identity.keyHmac,
      p_request_hash: identity.requestHash,
    });
    if (error || !Array.isArray(data) || !data[0]) {
      if (error?.message?.includes("AI_QUOTA_EXCEEDED")) throw new AppError({statusCode:429,code:"AI_QUOTA_EXCEEDED",message:"Analysis capacity is temporarily full. Try later or save without analysis."});
      if (error?.message?.includes("JOURNAL_NOT_FOUND")) throw new NotFoundError("The submitted journal was deleted. Start a new reflection to write again.");
      if (error?.message?.includes("ANALYSIS_GATE_FAILED")) {
        await this.recordRejectedIdempotency(userId, identity, "ANALYSIS_GATE_FAILED");
        throw new AnalysisGateError(
          "Analysis eligibility changed before saving. Review your settings or explicitly turn analysis off.",
        );
      }
      if ((error as { message?: string } | null)?.message?.includes("IDEMPOTENCY_CONFLICT"))
        throw new ConflictError(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was used for a different journal request.",
        );
      throw databaseError(
        error,
        { module: "journals", schema: "journal_service", table: "submit_journal", operation: "submit journal" },
        "The journal could not be saved.",
      );
    }
    const row = data[0] as Record<string, unknown>;
    const journalId = asString(row.journal_id);
    const jobId = asString(row.analysis_job_id);
    const replayed = row.replayed === true;
    if (!analysisRequested) return { kind: "private", journalId, replayed };
    const facialStatus = await this.recordFacialMetadata(
      userId,
      journalId,
      jobId,
      input.facialAnalysisRequested,
      input.facialCapture,
    );
    const submission = {
      journalId,
      analysisJobId: jobId,
      status: asString(row.result_status, initialStatus) as "queued" | "waiting_for_provider",
      facialStatus,
    };
    if (!replayed && this.runtime.mode === "development_stub" && initialStatus === "queued") {
      this.runner.enqueue(() => this.processDevelopmentJob(userId, journalId, jobId, input.body, fixture));
    }
    return { kind: "analysis", submission, replayed };
  }

  private async hasGlobalAnalysisConsent(userId: string): Promise<boolean> {
    const { data, error } = await this.database
      .schema("user_service")
      .from("privacy_preferences")
      .select("journal_ai_analysis_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Analysis consent could not be checked.");
    return (data as Record<string, unknown> | null)?.journal_ai_analysis_enabled === true;
  }

  private async assertAnalysisGates(userId: string): Promise<void> {
    await assertAiEnabled();
    await assertTrustedContact(this.database, userId);
    const [profileResult, verificationResult] = await Promise.all([
      this.database
        .schema("user_service")
        .from("profiles")
        .select("account_status,onboarding_completed,eligible_18_plus")
        .eq("user_id", userId)
        .maybeSingle(),
      this.database
        .schema("verification_service")
        .from("identity_verifications")
        .select("verification_status,approved_expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profileResult.error || verificationResult.error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Analysis eligibility could not be checked.");
    const profile = profileResult.data as Record<string, unknown> | null;
    if (!profile || profile.account_status !== "active")
      throw new AuthorizationError("Your account is not currently eligible for analysis.");
    if (profile.onboarding_completed !== true)
      throw new AuthorizationError("Complete onboarding before requesting analysis.");
    if (profile.eligible_18_plus !== true)
      throw new AuthorizationError("Current age eligibility is required for analysis.");
    const verification = verificationResult.data as Record<string, unknown> | null;
    if (!verification || verification.verification_status !== "approved")
      throw new AuthorizationError("Approved verification is required for analysis.");
    if (
      typeof verification.approved_expires_at === "string" &&
      new Date(verification.approved_expires_at) <= new Date()
    )
      throw new AuthorizationError("Your analysis verification has expired.");
    const { data: active, error: policyError } = await this.database
      .schema("auth_provisioning")
      .from("policy_documents")
      .select("document_type,version")
      .eq("is_active", true);
    const { data: accepted, error: consentError } = await this.database
      .schema("user_service")
      .from("user_consents")
      .select("consent_type,consent_version,accepted")
      .eq("user_id", userId)
      .eq("accepted", true);
    if (policyError || consentError || !active)
      throw new ExternalServiceError("POLICIES_UNAVAILABLE", "Current policies could not be checked.");
    const keys = new Set((accepted ?? []).map((item) => `${item.consent_type}:${item.consent_version}`));
    if (active.length !== 3 || active.some((item) => !keys.has(`${item.document_type}:${item.version}`)))
      throw new AuthorizationError("Review the current policies before requesting analysis.");
  }

  private authorizeFixture(userId: string, requested?: string): AnalysisFixture {
    if (!requested) return "standard_low_distress";
    if (
      this.runtime.isProduction ||
      this.runtime.mode !== "development_stub" ||
      !this.runtime.developmentUserIds.has(userId)
    )
      throw new AuthorizationError("Development analysis fixtures are not available for this request.");
    const parsed = analysisFixtureSchema.safeParse(requested);
    if (!parsed.success) throw new ValidationError({ fixture: ["The development fixture is invalid."] });
    return parsed.data;
  }

  private async initialAnalysisStatus(): Promise<"queued" | "waiting_for_provider"> {
    if (this.runtime.mode === "development_stub") return "queued";
    if (this.runtime.mode === "disabled") return "waiting_for_provider";
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data } = await this.database
      .schema("ai_analysis")
      .from("worker_health")
      .select("worker_id")
      .eq("accepting_jobs", true)
      .gte("last_heartbeat_at", cutoff)
      .limit(1);
    return data?.length ? "queued" : "waiting_for_provider";
  }

  private async recordRejectedIdempotency(userId: string, identity: IdempotencyIdentity, code: string): Promise<void> {
    const { error } = await this.database.schema("ai_analysis").rpc("reserve_rejected_submission", {
      p_user_id: userId,
      p_version: identity.keyVersion,
      p_hmac: identity.keyHmac,
      p_hash: identity.requestHash,
      p_code: code,
    });
    if (error?.message?.includes("IDEMPOTENCY_CONFLICT"))
      throw new ConflictError("IDEMPOTENCY_CONFLICT", "The key was already used for different content.");
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The rejected request could not be reserved safely.");
  }

  private async setJobStatus(jobId: string, status: AnalysisStatus, attempt: number): Promise<void> {
    const { data: current } = await this.database
      .schema("ai_analysis")
      .from("analysis_requests")
      .select("status,progress")
      .eq("id", jobId)
      .maybeSingle();
    if (!current) throw new NotFoundError("The analysis job was not found.");
    assertAnalysisTransition(current.status as AnalysisStatus, status, {
      currentGatesChecked: true,
      attemptAllowed: attempt < 3,
    });
    const monotonic = analysisProgressFor(status, attempt, Number((current as { progress?: number }).progress ?? 0));
    const { error } = await this.database.schema("ai_analysis").rpc("advance_stub_job", {
      p_job_id: jobId,
      p_expected: current.status,
      p_status: status,
      p_attempt: attempt,
      p_progress: monotonic,
    });
    if (error) throw new ConflictError("ANALYSIS_TRANSITION_REJECTED", "The development job transition was rejected.");
  }

  private async processDevelopmentJob(
    userId: string,
    journalId: string,
    jobId: string,
    body: string,
    fixture: AnalysisFixture,
  ): Promise<void> {
    const { data: job } = await this.database
      .schema("ai_analysis")
      .from("analysis_requests")
      .select("status,attempt_count")
      .eq("id", jobId)
      .eq("user_id", userId)
      .eq("processing_mode", "development_stub")
      .is("deleted_at", null)
      .maybeSingle();
    if (!job || ["completed", "failed", "safety_action_required"].includes((job as { status: string }).status)) return;
    const resumed = job.status === "analyzing_emotions";
    const attempt = Math.min(3, Number((job as { attempt_count?: number }).attempt_count ?? 0) + (resumed ? 0 : 1));
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Development analysis timed out.")),
      this.runtime.timeoutMs,
    );
    try {
      await assertAiEnabled();
      const output = await this.analysisProvider.analyze(
        { requestId: jobId, journalId, journalText: body, fixture, reviewedResume: resumed },
        {
          signal: AbortSignal.any([controller.signal, this.runner.signal]),
          onProgress: ({ status }) => this.setJobStatus(jobId, status, attempt),
        },
      );
      if (output.safetyActionRequired) return;
      const validated = journalAnalysisResultSchema.safeParse(output.result);
      if (!validated.success) throw new ValidationError({ result: ["The provider result failed strict validation."] });
      await this.setJobStatus(jobId, "aggregating_week", attempt);
      const { error } = await this.database
        .schema("ai_analysis")
        .rpc("complete_journal_analysis", { p_job_id: jobId, p_result: this.encryptAnalysisResult(validated.data) });
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The analysis result could not be committed.");
    } catch {
      if (this.runner.signal.aborted) return; // Startup recovery owns abandoned stub work.
      if (attempt < 3) {
        await this.setJobStatus(jobId, "retrying", attempt);
        const { data: next, error } = await this.database.schema("ai_analysis").rpc("requeue_job", {
          p_job_id: jobId,
          p_mode: "development_stub",
          p_transition_key: `retrying:${attempt}:development-stub-v1`,
        });
        if (!error && next === "queued")
          this.runner.enqueue(() => this.processDevelopmentJob(userId, journalId, jobId, body, fixture));
      } else {
        await this.setJobStatus(jobId, "failed", attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async recoverDevelopmentJobs(): Promise<void> {
    if (this.runtime.mode !== "development_stub") return;
    const { data } = await this.database
      .schema("ai_analysis")
      .from("analysis_requests")
      .select("id,user_id,journal_id,status,fixture,attempt_count,processing_mode")
      .not("status", "in", "(completed,failed,safety_action_required)")
      .not("journal_id", "is", null)
      .in("processing_mode", ["disabled", "development_stub"])
      .is("deleted_at", null);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const jobId = asString(row.id);
      const userId = asString(row.user_id);
      const journalId = asString(row.journal_id);
      if (row.processing_mode === "disabled" && row.status !== "waiting_for_provider") continue;
      if (row.status === "analyzing_emotions") {
        const { data: review } = await this.database
          .schema("ai_analysis")
          .from("safety_reviews")
          .select("id")
          .eq("job_id", jobId)
          .eq("decision", "approved_continue")
          .limit(1)
          .maybeSingle();
        if (review) {
          const journal = await this.get(userId, journalId);
          this.runner.enqueue(() =>
            this.processDevelopmentJob(
              userId,
              journalId,
              jobId,
              journal.body,
              analysisFixtureSchema.parse(row.fixture),
            ),
          );
          continue;
        }
      }
      // Called once at process startup; it must never scan a live development runner.
      if (!["queued", "retrying", "waiting_for_provider"].includes(asString(row.status))) {
        await this.setJobStatus(jobId, "retrying", Number(row.attempt_count));
        row.status = "retrying";
      }
      if (row.status !== "queued") {
        const { data: status, error } = await this.database.schema("ai_analysis").rpc("requeue_job", {
          p_job_id: jobId,
          p_mode: "development_stub",
          p_transition_key: `${row.status}:${row.attempt_count}:development-stub-v1`,
        });
        if (error) throw new ExternalServiceError("RECOVERY_UNAVAILABLE", "Development recovery could not complete.");
        if (status !== "queued") continue;
      }
      const journal = await this.get(userId, journalId);
      const fixture = analysisFixtureSchema.catch("standard_low_distress").parse(row.fixture);
      this.runner.enqueue(() => this.processDevelopmentJob(userId, journalId, jobId, journal.body, fixture));
    }
  }

  async update(userId: string, journalId: string, input: Partial<JournalInput>): Promise<JournalResponse> {
    const current = await this.get(userId, journalId);
    const next: JournalInput = {
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      mood: input.mood ?? (current.mood as JournalInput["mood"]),
      emotions: input.emotions ?? current.emotions,
      tags: input.tags ?? current.tags,
      privacyStatus: input.privacyStatus ?? (current.privacy_status as JournalInput["privacyStatus"]),
      analysisConsent: input.analysisConsent ?? current.analysis_consent,
      facialAnalysisRequested: input.facialAnalysisRequested ?? false,
      facialCapture: input.facialCapture,
    };
    const encrypted = this.encryptJournal(next);
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journals")
      .update({
        title: "[encrypted]",
        content_ciphertext: bytea(encrypted.ciphertext),
        encryption_iv: bytea(encrypted.iv),
        encryption_auth_tag: bytea(encrypted.authenticationTag),
        encryption_key_version: encrypted.keyVersion,
        word_count: next.body.trim() ? next.body.trim().split(/\s+/).length : 0,
        mood: next.mood,
        emotions: next.emotions,
        tags: next.tags,
        privacy_status: next.privacyStatus,
        analysis_consent: this.localResults ? false : next.analysisConsent,
      })
      .eq("id", journalId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal could not be updated.");
    if (!data) throw new NotFoundError("The journal entry was not found.");
    if(this.localResults && (input.analysisConsent===false || (input.body!==undefined && input.body!==current.body)))this.localResults.remove(userId,journalId);
    return this.toJournalResponse(data as JournalRow, await this.latestAnalysis(journalId, userId));
  }

  async remove(userId: string, journalId: string): Promise<void> {
    const { error, count } = await this.database
      .schema("journal_service")
      .from("journals")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", journalId)
      .eq("user_id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal could not be deleted.");
    if (!count) throw new NotFoundError("The journal entry was not found.");
    this.localResults?.remove(userId,journalId);
  }

  private toDraftResponse(row: JournalRow): JournalDraftResponse {
    const draft = this.decryptJournal(row);
    return {
      submission_key: typeof row.submission_key === "string" ? row.submission_key : undefined,
      id: asString(row.id, asString(row.user_id)),
      title: draft.title,
      body: draft.body,
      mood: asString(row.mood, "calm"),
      emotions: asStringArray(row.emotions),
      tags: asStringArray(row.tags),
      privacy_status: asString(row.privacy_status, "private"),
      analysis_consent: row.analysis_consent === true,
      updated_at: asString(row.updated_at),
    };
  }

  async saveDraft(userId: string, input: JournalDraftInput): Promise<JournalDraftResponse> {
    const encrypted = this.encryptJournal(input);
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_drafts")
      .upsert(
        {
          user_id: userId,
          submission_key: input.submissionKey ?? null,
          title: "[encrypted]",
          content_ciphertext: bytea(encrypted.ciphertext),
          encryption_iv: bytea(encrypted.iv),
          encryption_auth_tag: bytea(encrypted.authenticationTag),
          encryption_key_version: encrypted.keyVersion,
          mood: input.mood,
          emotions: input.emotions,
          tags: input.tags,
          privacy_status: input.privacyStatus,
          analysis_consent: input.analysisConsent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error || !data) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journal_drafts", operation: "save draft" }, "Your draft could not be saved.");
    return this.toDraftResponse(data as JournalRow);
  }

  async getDraft(userId: string): Promise<JournalDraftResponse | null> {
    const { data, error } = await this.reader
      .schema("journal_service")
      .from("journal_drafts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journal_drafts", operation: "load draft" }, "Your draft could not be loaded.");
    return data ? this.toDraftResponse(data as JournalRow) : null;
  }

  async deleteDraft(userId: string, submissionKey?: string): Promise<void> {
    let query = this.database
      .schema("journal_service")
      .from("journal_drafts")
      .delete()
      .eq("user_id", userId);
    if (submissionKey) query = query.eq("submission_key", submissionKey);
    const {error} = await query;
    if (error) throw databaseError(error, { module: "journals", schema: "journal_service", table: "journal_drafts", operation: "remove draft" }, "Your draft could not be removed.");
  }

  private screeningActive=new Set<string>();
  async retryScreening(user:string,journal:string){
    const entry=await this.get(user,journal);await this.assertAnalysisGates(user);
    if(!this.localResults||!this.coreClient||!await this.hasGlobalAnalysisConsent(user))throw new AnalysisGateError('Local screening is unavailable.');
    const job=this.localResults.journal(user,journal);if(!job?.result_ciphertext)throw new NotFoundError('No completed analysis.');
    const key=user+':'+journal;if(this.screeningActive.has(key))throw new ConflictError('RETRY_BUSY','Screening retry in progress.');this.screeningActive.add(key);
    try{this.localResults.reserveScreening(user,job.id);const previous=this.readAnalysisResult({ciphertext:job.result_ciphertext});if(previous.schemaVersion==='echo-journal-analysis-v1')throw new ConflictError('RETRY_UNSUPPORTED','Legacy results cannot be retried.');
    const screening=journalScreeningSchema.parse(await this.coreClient.screening(entry.body));
    await this.assertAnalysisGates(user);if(!await this.hasGlobalAnalysisConsent(user)||(await this.get(user,journal)).body!==entry.body||!this.localResults.get(user,job.id))throw new ConflictError('JOURNAL_CHANGED','Result discarded because the reflection or consent changed.');
    this.localResults.replaceScreening(user,job.id,{...previous,schemaVersion:'echo-journal-analysis-v3',journalScreening:screening});return {updated:true};}finally{this.screeningActive.delete(key);}
  }
  async retryLocalAnalysis(userId:string,journalId:string){
    await this.get(userId,journalId);
    if(!this.localResults)throw new NotFoundError('Local storage is disabled.');
    if(!await this.hasGlobalAnalysisConsent(userId))throw new AnalysisGateError('Analysis consent is disabled.');
    await this.assertAnalysisGates(userId);
    const job=this.localResults.journal(userId,journalId);if(!job)throw new NotFoundError('Local analysis job unavailable.');
    this.localResults.retry(userId,job.id);this.enqueueLocal(this.localResults.get(userId,job.id)!);
    return {queued:true};
  }
  async analyze(userId: string, journalId: string): Promise<AnalysisResponse> {

    const existing = await this.getLatestAnalysis(userId, journalId);
    if (existing) return existing;
    throw new ValidationError({
      analysis: ["Analysis must be explicitly requested when the journal is first submitted."],
    });
  }

  async getAnalysisStatus(userId: string, jobId: string) {
    if(this.localResults){
      const job=this.localResults.get(userId,jobId);if(!job)throw new NotFoundError('The local analysis job was not found.');
      await this.get(userId,job.journal_id);
      return {userId,journalId:job.journal_id,jobId:job.id,status:job.status,progress:job.progress,facialStatus:job.facial_status,updatedAt:job.updated_at,
        checks:analysisChecksFor(job.status,job.facial_status,job.progress).map(x=>x.id==='phq8'?{...x,state:(job.status==='completed'?(job.result_ciphertext&&JSON.parse(job.result_ciphertext).journalScreening?.status==='available'?'complete':'partial'):'pending') as 'complete'|'partial'|'pending',detail:'Experimental journal estimate; questionnaire remains separate'}:x)};
    }
    const { data, error } = await this.database
      .schema("public")
      .from("analysis_status_projection")
      .select("user_id,journal_id,job_id,status,progress,facial_status,updated_at")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Analysis status is temporarily unavailable.");
    if (!data) throw new NotFoundError("The analysis job was not found.");
    const status = data.status as AnalysisStatus;
    const facialStatus = asString(data.facial_status, "not_requested") as FacialAnalysisStatus;
    return {
      userId: data.user_id,
      journalId: data.journal_id,
      jobId: data.job_id,
      status,
      progress: data.progress,
      facialStatus,
      checks: analysisChecksFor(status, facialStatus, data.progress).map(check => this.runtime.mode === "local_worker" && check.id === "phq8"
        ? { ...check, state: "skipped" as const, detail: "Screening estimate unavailable; questionnaire check-ins stay separate" } : check),
      updatedAt: data.updated_at,
    };
  }

  async getLatestAnalysis(userId: string, journalId: string): Promise<AnalysisResponse | null> {
    await this.get(userId, journalId);
    if(this.localResults){const job=this.localResults.journal(userId,journalId);return job?.result_ciphertext?this.toAnalysisResponse(this.localRow(job)):null;}
    const { data: request, error } = await this.database
      .schema("ai_analysis")
      .from("analysis_requests")
      .select("id,journal_id,status,facial_status,created_at")
      .eq("journal_id", journalId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Analysis is temporarily unavailable.");
    if (!request) return null;
    const { data: result, error: resultError } = await this.database
      .schema("ai_analysis")
      .from("analysis_results")
      .select("*")
      .eq("analysis_request_id", request.id)
      .maybeSingle();
    if (resultError) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Analysis is temporarily unavailable.");
    return result
      ? this.toAnalysisResponse({
          ...(result as AnalysisRow),
          journal_id: journalId,
          status: request.status,
          facial_status: request.facial_status,
        })
      : null;
  }

  async dashboardInsights(userId: string, input: AnalysisInsightsRangeInput = { range: "30d" }) {
    if(this.localResults)return this.localDashboard(userId,input);
    const now = new Date();
    const days = input.range === "7d" ? 7 : input.range === "90d" ? 90 : 30;
    const from = input.range === "custom" && input.from
      ? new Date(`${input.from}T00:00:00.000Z`)
      : new Date(now.getTime() - (days - 1) * 86_400_000);
    if (input.range !== "custom") from.setUTCHours(0, 0, 0, 0);
    const to = input.range === "custom" && input.to ? new Date(`${input.to}T23:59:59.999Z`) : now;
    let query = this.database
      .schema("ai_analysis")
      .from("analysis_results")
      .select("id,result_payload,is_simulated,created_at,analysis_requests!inner(deleted_at,facial_status)")
      .eq("user_id", userId)
      .is("analysis_requests.deleted_at", null)
      .not("result_payload", "is", null)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true });
    if (this.runtime.isProduction) query = query.eq("is_simulated", false);
    const { data: results, error } = await query;
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Dashboard insights are temporarily unavailable.");
    const rows = (results ?? []) as Array<Record<string, unknown>>;
    const latestRow = rows.at(-1);
    const latest = latestRow?.result_payload ? this.readAnalysisResult(latestRow.result_payload) : null;
    const latestRequestValue = latestRow?.analysis_requests;
    const latestRequest = (Array.isArray(latestRequestValue) ? latestRequestValue[0] : latestRequestValue) as
      | Record<string, unknown>
      | undefined;
    const dailyRows = [...new Map(rows.map((row) => [asString(row.created_at).slice(0, 10), row])).values()];
    let recommendation = null;
    if (latestRow) {
      const { data } = await this.database
        .schema("ai_analysis")
        .from("recommendation_selections")
        .select("id,recommendation_rules(title,description,activity)")
        .eq("analysis_result_id", latestRow.id)
        .maybeSingle();
      const rule = (data as Record<string, unknown> | null)?.recommendation_rules as
        Record<string, unknown> | undefined;
      if (data && rule)
        recommendation = {
          id: asString((data as Record<string, unknown>).id),
          title: asString(rule.title),
          description: asString(rule.description),
          activity: asString(rule.activity),
        };
    }
    return {
      latest,
      latestResultId: latestRow ? asString(latestRow.id) : null,
      recommendation,
      emotionTrend: dailyRows.flatMap((row) => {
        const parsed = this.readAnalysisResult(row.result_payload);
        if (parsed.schemaVersion !== latest?.schemaVersion) return [];
        return [{
          date: asString(row.created_at).slice(0, 10),
          values: Object.fromEntries(parsed.emotionDistribution.map((item) => [item.emotion, item.value])),
          isSimulated: parsed.isSimulated,
          schemaVersion: parsed.schemaVersion,
        }];
      }),
      distressTrend: dailyRows.flatMap((row) => {
        const parsed = this.readAnalysisResult(row.result_payload);
        if (parsed.schemaVersion !== "echo-journal-analysis-v1") return [];
        return [{
          date: asString(row.created_at).slice(0, 10),
          band: parsed.distressBand,
          value: ["low", "mild", "moderate", "high", "severe"].indexOf(parsed.distressBand) / 4,
          isSimulated: parsed.isSimulated,
        }];
      }),
      period: {
        range: input.range,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        analyzedReflectionCount: rows.length,
      },
      facialStatus: facialAnalysisStatusSchema.catch("not_requested").parse(latestRequest?.facial_status),
    };
  }

  async resolveSupportResources(countryCode: string, regionCode?: string) {
    let query = this.database
      .schema("grounding_service")
      .from("support_resources")
      .select(
        "id,country_code,region_code,support_resource_type,organization_name,resource_name,description,phone_number,sms_number,website_url,availability_text,last_verified_at",
      )
      .eq("country_code", countryCode)
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("display_priority");
    if (regionCode) query = query.or(`region_code.eq.${regionCode},region_code.is.null`);
    const { data, error } = await query;
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Verified support resources are temporarily unavailable.");
    return data ?? [];
  }

  async requestSupportContact(userId: string, trustedContactId: string, jobId?: string) {
    if(this.localResults && jobId)throw new ExternalServiceError("LOCAL_CONTACT_UNAVAILABLE","Contact-review requests linked to local analysis are unavailable. Support resources remain available.");
    const { data: contact, error } = await this.database
      .schema("user_service")
      .from("trusted_contacts")
      .select("id,verified,relationship,permission_acknowledged_at")
      .eq("id", trustedContactId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your trusted contact could not be checked.");
    if (!contact) throw new NotFoundError("The trusted contact was not found.");
    let safetyEventId: string | undefined;
    if (jobId) {
      const { data: job } = await this.database
        .schema("ai_analysis")
        .from("analysis_requests")
        .select("id")
        .eq("id", jobId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!job) throw new NotFoundError("The support context is no longer active.");
      const { data: event } = await this.database
        .schema("ai_analysis")
        .from("safety_events")
        .select("id")
        .eq("analysis_request_id", jobId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!event) throw new NotFoundError("The support context is not available.");
      safetyEventId = event.id;
    }
    const { data: profile, error: profileError } = await this.database
      .schema("user_service")
      .from("profiles")
      .select("eligible_18_plus,account_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Support eligibility could not be checked.");
    const approved = Boolean(
      contact.verified &&
      contact.permission_acknowledged_at &&
      contact.relationship &&
      profile?.eligible_18_plus &&
      profile.account_status === "active",
    );
    const { data: request, error: insertError } = await this.database
      .schema("notification_service")
      .from("support_contact_requests")
      .insert({
        user_id: userId,
        trusted_contact_id: trustedContactId,
        safety_event_id: safetyEventId,
        status: approved ? "review_required" : "denied",
        decision_code: approved ? "USER_INITIATED_CONTACT_REVIEW" : "CONTACT_OR_AGE_POLICY_DENIED",
      })
      .select("id,status,decision_code")
      .single();
    await this.database
      .schema("user_service")
      .from("audit_events")
      .insert({
        user_id: userId,
        actor_user_id: userId,
        event_type: approved ? "support_contact.review_requested" : "support_contact.denied",
        resource_type: "support_contact_request",
        resource_id: request?.id,
        metadata: { decision_code: approved ? "VERIFIED" : "DENIED" },
      });
    if (insertError)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The support request could not be recorded.");
    if (!approved) throw new AuthorizationError("This contact is not verified and permitted for support requests.");
    return request;
  }

  async createBuddyHandoff(userId: string, analysisResultId: string) {
    if(this.localResults){const job=this.localResults.get(userId,analysisResultId);if(!job)throw new NotFoundError('Local analysis is unavailable.');await this.get(userId,job.journal_id);return this.localResults.handoff(userId,analysisResultId);}
    const { data: result, error } = await this.database
      .schema("ai_analysis")
      .from("analysis_results")
      .select("id,result_payload")
      .eq("id", analysisResultId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !result) throw new NotFoundError("The analysis result was not found.");
    const parsed = this.readAnalysisResult(result.result_payload);
    const { data: selection } = await this.database
      .schema("ai_analysis")
      .from("recommendation_selections")
      .select("id")
      .eq("analysis_result_id", analysisResultId)
      .single();
    if (!selection) throw new NotFoundError("The reviewed recommendation was not found.");
    const { data: handoff, error: handoffError } = await this.database
      .schema("buddy_service")
      .from("recommendation_handoffs")
      .insert({
        user_id: userId,
        analysis_result_id: analysisResultId,
        recommendation_selection_id: selection.id,
        approved_context: {
          dominantEmotion: parsed.dominantEmotion,
          ...(parsed.schemaVersion !== "echo-journal-analysis-v1" ? { distressCategory: parsed.distressCategory } : { distressBand: parsed.distressBand }),
          recommendationFeatures: parsed.recommendationFeatures,
        },
        expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      .select("id,expires_at")
      .single();
    if (handoffError) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The Buddy handoff could not be created.");
    return { handoffId: handoff.id, expiresAt: handoff.expires_at };
  }

  async getBuddyHandoff(userId: string, handoffId: string) {
    if(this.localResults){const handoff=this.localResults.readHandoff(userId,handoffId);const job=handoff?this.localResults.get(userId,handoff.job_id):undefined;if(!job?.result_ciphertext)throw new NotFoundError('The local activity is unavailable.');await this.get(userId,job.journal_id);return {id:handoffId,expiresAt:handoff!.expires_at,recommendation:this.localRecommendation(job)};}
    const { data, error } = await this.database
      .schema("buddy_service")
      .from("recommendation_handoffs")
      .select("id,analysis_result_id,expires_at,recommendation_selection_id")
      .eq("id", handoffId)
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) throw new NotFoundError("The recommendation handoff is unavailable or expired.");
    const { data: source } = await this.database
      .schema("ai_analysis")
      .from("analysis_results")
      .select("id,analysis_requests!inner(deleted_at)")
      .eq("id", data.analysis_result_id)
      .eq("user_id", userId)
      .is("analysis_requests.deleted_at", null)
      .maybeSingle();
    if (!source) throw new NotFoundError("The source reflection is no longer available.");
    const { data: selection } = await this.database
      .schema("ai_analysis")
      .from("recommendation_selections")
      .select("id,recommendation_rules(title,description,activity)")
      .eq("id", data.recommendation_selection_id)
      .single();
    if (!selection) throw new NotFoundError("The reviewed activity was not found.");
    return { id: data.id, expiresAt: data.expires_at, recommendation: selection.recommendation_rules };
  }

  async resolveSafetyReview(
    reviewerId: string,
    jobId: string,
    decision: "approved_continue" | "end_analysis",
    decisionKey: string,
  ) {
    if(this.localResults){
      const job=this.localResults.find(jobId);if(!job)throw new NotFoundError('The local review job is unavailable.');
      const {data,error}=await this.database.schema('ai_analysis').from('safety_reviewers').select('user_id').eq('user_id',reviewerId).maybeSingle();
      if(error||!data)throw new AuthorizationError('Restricted safety-review permission is required.');
      const outcome=this.localResults.review(reviewerId,job.user_id,jobId,decision,decisionKey);
      if(decision==='approved_continue')this.enqueueLocal(this.localResults.get(job.user_id,jobId)!);
      return outcome;
    }
    const { data, error } = await this.database.schema("ai_analysis").rpc("resolve_safety_review", {
      p_reviewer: reviewerId,
      p_job_id: jobId,
      p_decision: decision,
      p_key: decisionKey,
    });
    if (error?.message.includes("PERMISSION_REQUIRED"))
      throw new AuthorizationError("Restricted safety-review permission is required.");
    if (error)
      throw new ConflictError("SAFETY_REVIEW_REJECTED", "The safety review could not be applied in the current state.");
    if (decision === "approved_continue" && !data.replayed && this.runtime.mode === "development_stub") {
      const { data: job } = await this.database
        .schema("ai_analysis")
        .from("analysis_requests")
        .select("user_id,journal_id,fixture,processing_mode")
        .eq("id", jobId)
        .single();
      if (job?.processing_mode === "development_stub") {
        const journal = await this.get(job.user_id, job.journal_id);
        this.runner.enqueue(() =>
          this.processDevelopmentJob(
            job.user_id,
            job.journal_id,
            jobId,
            journal.body,
            analysisFixtureSchema.parse(job.fixture),
          ),
        );
      }
    }
    return data;
  }

  private toAnalysisResponse(row: AnalysisRow): AnalysisResponse {
    const result = row.result_payload ? this.readAnalysisResult(row.result_payload) : undefined;
    return {
      id: asString(row.id),
      entry_id: asString(row.journal_id),
      summary: result
        ? `${result.dominantEmotion} was the strongest ${result.isSimulated ? "simulated " : ""}signal.`
        : "No result is available.",
      perspective: "This AI-generated estimate is not a diagnosis or completed PHQ-8 assessment.",
      mood_insight: result?.dominantEmotion ?? "Unavailable",
      risk_indication: result && result.schemaVersion !== "echo-journal-analysis-v1" ? `${result.distressCategory} category; clinical severity unavailable` : result?.distressBand ?? "Unavailable",
      is_demo_data: result?.isSimulated ?? false,
      created_at: asString(row.created_at),
      status: asString(row.status),
      phq8_score: result?.depressiveSymptomRange ? Math.round((result.depressiveSymptomRange.lower + result.depressiveSymptomRange.upper) / 2) : null,
      severity: typeof row.severity === "string" ? row.severity : null,
      urgent_language_detected: row.urgent_language_detected === true,
      provider: result?.providerName ?? "unavailable",
      facial_status: asString(row.facial_status, "not_requested") as FacialAnalysisStatus,
      result,
    };
  }
}
