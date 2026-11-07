import {ModelPageLeases} from '../../infrastructure/analysis/model-page-leases.js';
import {LocalVoiceJobs} from './local-voice-jobs.js';
import {appPresence} from '../../infrastructure/security/app-presence.js';
import {z} from 'zod';
import {prepareBuddyContext} from './buddy-context.js';
import { AuthorizationError } from "../../shared/errors/app-error.js";
import { assertAiEnabled as assertVoiceEnabled } from "../../infrastructure/security/runtime-controls.js";
import { LocalBuddyStore } from "../../infrastructure/analysis/local-buddy-store.js";
import { randomUUID } from "node:crypto";
import { generationStageSchema } from "@echo/contracts";
import { WellnessService, defaultWellnessSchedule, type WellnessSchedule } from "./wellness.service.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../journals/journals.service.js";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { encryptText, decryptText } from "../../infrastructure/encryption/encryption.service.js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";
import { ConflictError, ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";
import type { CoreClient, ChatTurn } from "../../infrastructure/analysis/core-client.js";

type DatabaseRow = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function hasReviewableSource(row: DatabaseRow): boolean {
  const source = asString(row.verification_source);
  const checkedAt = asString(row.last_verified_at);
  try {
    const url = new URL(source);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && checkedAt.length > 0
      && !Number.isNaN(Date.parse(checkedAt))
      && Date.parse(checkedAt) <= Date.now();
  } catch {
    return false;
  }
}

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function throwIfDatabaseError(error: unknown, operation: SupabaseOperation, message: string): void {
  if (!error) return;
  logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  throw databaseError(message);
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function calculateStreak(entries: Array<{ created_at: string }>): number {
  const dates = new Set(entries.map((entry) => dateKey(entry.created_at)));
  const cursor = startOfUtcDay(new Date());
  if (!dates.has(dateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function requiresUrgentBuddySupport(message: string): boolean {
  return /\b(suicide|kill myself|end my life|take my life|hurt myself|harm myself|self[ -]harm|want to die|overdos\w*|(?:can't|cannot|can not|don't think i can|do not think i can) keep myself safe|not safe tonight)\b/i.test(message);
}

function buddyReply(message: string, urgent: boolean): string {
  if (urgent) {
    return "Thank you for telling me. Your immediate safety matters most. Please open Find help or Crisis support now and contact a trusted person who can stay with you. If you are in immediate danger, contact local emergency services now.";
  }
  const normalized = message.toLowerCase();
  if (/\b(no thanks|no thank you|stop (?:this |the )?conversation|stop (?:talking|chatting)|leave me alone|(?:don't|do not) want suggestions)\b/.test(normalized)) {
    return "Okay. We can stop here. You can close this chat whenever you choose. Support options are available if you want them later.";
  }
  if (/\b(do i have|diagnos\w*|medication|medicine|antidepressant\w*|prescription|take or stop)\b/.test(normalized)) {
    return "I cannot diagnose a condition or advise you to start, change, or stop medication. A qualified health professional can help you assess this safely. You can open Find help if you want support finding one.";
  }
  if (/\b(counselor|counsellor|therapist|professional help|talk to a professional)\b/.test(normalized)) {
    return "Talking with a counselor or another qualified professional is a reasonable next step. You can open Find help to explore support options, and you can choose whether to continue here.";
  }
  if (normalized.includes("anx") || normalized.includes("overwhelm") || normalized.includes("tight")) {
    return "Let us make this moment smaller. Place both feet down, take one unforced breath, and name one thing around you that feels steady.";
  }
  if (normalized.includes("sad") || normalized.includes("alone") || normalized.includes("lonely")) {
    return "That sounds heavy to carry alone. What is one gentle thing you need most right now: rest, company, space, or a practical next step?";
  }
  if (normalized.includes("angry") || normalized.includes("frustrat")) {
    return "There is room for that frustration here. Before deciding what to do, can you name what boundary or need feels most important underneath it?";
  }
  return "I am here with you. What part of that feels most present right now, and what would make the next few minutes a little gentler?";
}

function buddyTitle(message: string): string {
  const text = message.toLowerCase();
  if (/\b(overwhelmed?|anxious|anxiety|stressed?|tense)\b/.test(text)) return "Feeling overwhelmed today";
  if (/\b(sleep|tired|rest|insomnia)\b/.test(text)) return "Finding rest today";
  if (/\b(sad|lonely|alone|grief)\b/.test(text)) return "Working through a hard day";
  if (/\b(angry|frustrated?|frustration)\b/.test(text)) return "Working through frustration";
  return "A conversation with Buddy";
}

function searchWords(value: string): string[] {
  return [...new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 256);
}

export class ExperienceService {
  private temporary=new Map<string,{turns:ChatTurn[];expires:number}>();
  private approvedVoice=new Map<string,{text:string;expires:number}>();
  private voiceJobs=new LocalVoiceJobs(
    async(session,kind,signal)=>{if(!this.coreClient)throw new NotFoundError('Local voice is unavailable.');return this.coreClient.talk({task:kind==='speak'?'warm_nano':'warm_whisper',sessionId:session},signal);},
    async(session,payload,signal,user)=>{const result=await this.buddyVoiceTask(payload,signal,session);if(!signal.aborted&&payload.task==='speak'&&result.model&&this.localBuddy){const conversation=this.localBuddy.list(user).find(c=>c.messages.some(m=>m.role==='buddy'&&m.content===payload.text));if(conversation)await this.localBuddy.mutate(user,conversation.id,c=>{c.provenance.push({speech:result.model,at:new Date().toISOString()});return c;});}return result;},
    async session=>{if(this.coreClient)await this.coreClient.talk({task:'close',sessionId:session},AbortSignal.timeout(5000));},
  );
  async createVoiceOperation(user:string,kind:'speak'|'transcribe'){await assertVoiceEnabled();await this.historyEnabled(user);return this.voiceJobs.create(user,kind);}
  voiceOperationStatus(user:string,id:string){return this.voiceJobs.status(user,id);}
  voiceOperationResult(user:string,id:string){return this.voiceJobs.take(user,id);}
  cancelVoiceOperation(user:string,id:string){return this.voiceJobs.cancel(user,id);}
  async closeVoiceOperations(){await this.voiceJobs.close();}
  async submitVoiceOperation(user:string,id:string,kind:'speak'|'transcribe',payload:Record<string,unknown>){await assertVoiceEnabled();
    if(kind==='speak'){const text=String(payload.text??'');const allowed=[...this.approvedVoice.entries()].some(([key,v])=>key.startsWith(user+':')&&v.expires>Date.now()&&v.text===text)||this.localBuddy?.list(user).some(c=>c.messages.some(m=>m.role==='buddy'&&m.content===text));if(!allowed)throw new AuthorizationError('Only approved Buddy replies can be spoken.');}
    return this.voiceJobs.start(user,id,kind,payload);
  }
  async transcribeVoice(user:string,audio:Buffer,signal?:AbortSignal){await assertVoiceEnabled();await this.historyEnabled(user);if(!this.coreClient)throw new NotFoundError('Local speech is unavailable.');return this.buddyVoiceTask({task:'transcribe',audio:audio.toString('base64'),audioFormat:'encoded'},signal);}
  async speakVoice(user:string,text:string,signal?:AbortSignal){await assertVoiceEnabled();const allowed=[...this.approvedVoice.entries()].some(([key,v])=>key.startsWith(user+':')&&v.expires>Date.now()&&v.text===text);if(!allowed&&!this.localBuddy?.list(user).some(c=>c.messages.some(m=>m.role==='buddy'&&m.content===text)))throw new AuthorizationError('Only recent approved Buddy replies can be spoken.');if(!this.coreClient)throw new NotFoundError('Local speech unavailable.');const result=await this.buddyVoiceTask({task:'speak',text},signal);if(result.model&&this.localBuddy){const c=this.localBuddy.list(user).find(c=>c.messages.some(m=>m.role==='buddy'&&m.content===text));if(c){c.provenance.push({speech:result.model,at:new Date().toISOString()});await this.localBuddy.save(c);}}return result;}
  private async buddyVoiceTask(payload:Record<string,unknown>,signal?:AbortSignal,preparedSession?:string):Promise<{audio?:string;text?:string;model?:Record<string,unknown>}>{
    const sessionId=preparedSession??randomUUID();
    try{
      if(!preparedSession)await this.coreClient!.talk({task:payload.task==='transcribe'?'warm_whisper':'warm_nano',sessionId},signal);
      else try{await this.coreClient!.talk({task:'pulse',sessionId},signal);}catch(error){if(signal?.aborted)throw error;await this.coreClient!.talk({task:payload.task==='transcribe'?'warm_whisper':'warm_nano',sessionId},signal);}
      if(payload.task==='transcribe')return z.object({text:z.string(),model:z.record(z.string(),z.unknown()).optional()}).parse(await this.coreClient!.talk({...payload,sessionId},signal));
      const prepared=z.object({groups:z.array(z.array(z.string()))}).parse(await this.coreClient!.talk({task:'prepare',sessionId,text:payload.text,language:'English',speechMode:'sentences_2_then_3'},signal));
      const chunks:Buffer[]=[];let model:Record<string,unknown>|undefined;let bytes=0;
      for(const texts of prepared.groups){const result=z.object({segments:z.array(z.object({audio:z.string(),sampleRate:z.literal(48000),channels:z.literal(2)})),model:z.record(z.string(),z.unknown())}).parse(await this.coreClient!.talk({task:'speak',sessionId,texts,language:'English'},signal));model=result.model;for(const segment of result.segments){const data=Buffer.from(segment.audio,'base64');bytes+=data.length;if(!data.length||data.length%4||data.toString('base64')!==segment.audio||bytes>32*1024*1024)throw new ConflictError('BUDDY_AUDIO_LIMIT','Speech exceeded the safe audio limit. The approved text is retained.');chunks.push(data);}}
      const pcm=Buffer.concat(chunks);if(pcm.length>32*1024*1024)throw Error('Speech audio limit');
      const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(48000,24);h.writeUInt32LE(192000,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);
      return {audio:Buffer.concat([h,pcm]).toString('base64'),model};
    }finally{await this.coreClient!.talk({task:'close',sessionId}).catch(()=>{});}
  }
  private rememberReply(user:string,text:string){for(const [key,value] of this.approvedVoice)if(value.expires<Date.now())this.approvedVoice.delete(key);if(this.approvedVoice.size>=1000)this.approvedVoice.delete(this.approvedVoice.keys().next().value!);this.approvedVoice.set(user+':'+randomUUID(),{text,expires:Date.now()+1800000});}
  readonly wellness: WellnessService;
  constructor(
    private readonly database: SupabaseClient,
    private readonly journals: JournalService,
    private readonly encryption: EncryptionService,
    schedule: WellnessSchedule = defaultWellnessSchedule,
    private readonly userDatabase?: () => SupabaseClient,
    private readonly coreClient?: CoreClient,
    readonly localBuddy?: LocalBuddyStore,
  ) { this.wellness = new WellnessService(database, schedule, encryption, localBuddy ? async user=>(await journals.blockedLocalReflections(user))[0]?.journalId??null : undefined); }

  localJournalProcessing(user:string){return this.journals.localProcessing(user);}
  async cancelLocal(user:string,journal:string){await this.journals.get(user,journal);this.journals.cancelLocalWork(user,journal);await this.journals.localResults?.remove(user,journal);}
  async archiveLocal(user:string,id:string,archived:boolean){if(!this.localBuddy)throw new NotFoundError('Local storage is disabled.');return this.localBuddy.mutate(user,id,c=>({...c,archived}));}
  async exportLocal(user:string){if(!this.localBuddy||!this.journals.localResults)throw new NotFoundError('Local storage is disabled.');return {format:'echo-local-v1',...await this.journals.localResults.exportAccount(user)};}
  async clearLocal(user:string){this.journals.cancelLocalWork(user);await this.realtime?.endUser(user);await this.voiceJobs.clear(user);for(const key of this.temporary.keys())if(key.startsWith(user+':'))this.temporary.delete(key);for(const key of this.approvedVoice.keys())if(key.startsWith(user+':'))this.approvedVoice.delete(key);if(this.journals.localResults)await this.journals.localResults.clear(user);else await this.localBuddy?.clear(user);}
  async retryLocal(user:string,journal:string){return this.journals.retryLocalAnalysis(user,journal);}
  private get reader(): SupabaseClient { return this.userDatabase?.() ?? this.database; }

  private async historyEnabled(userId: string): Promise<boolean> {
    const { data, error } = await this.reader.schema("user_service").from("privacy_preferences")
      .select("buddy_history_enabled").eq("user_id", userId).maybeSingle();
    throwIfDatabaseError(error, {
      module: "experience.buddy", schema: "user_service", table: "privacy_preferences",
      operation: "select Buddy history preference",
    }, "Buddy privacy settings could not be loaded.");
    return data?.buddy_history_enabled !== false;
  }

  async buddyPrivacy(userId: string) {
    return { buddyHistoryEnabled: await this.historyEnabled(userId),
      historyStore: this.localBuddy?'local_json' as const:'supabase' as const,
      responderState: this.coreClient ? undefined : "DEMO_FALLBACK" as const };
  }

  private titleOf(row: DatabaseRow): string {
    return row.title_ciphertext
      ? decryptText(row.title_ciphertext, this.encryption)
      : asString(row.title, "Buddy conversation");
  }

  private conversationSummary(row: DatabaseRow) {
    return {
      id: asString(row.id), title: this.titleOf(row),
      preview: row.preview_ciphertext ? decryptText(row.preview_ciphertext, this.encryption) : "",
      pinned_at: row.pinned_at ?? null,
      last_message_at: row.last_message_at ?? null,
      created_at: row.created_at,
    };
  }

  async dashboard(userId: string, _range = "7d") {
    const [entries, analysisInsights, profileResult, preferenceResult] = await Promise.all([
      this.journals.listSummaries(userId),
      this.journals.dashboardInsights(userId, { range: "30d" }, true),
      this.reader.schema("user_service").from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      this.reader
        .schema("user_service")
        .from("notification_preferences")
        .select("reminder_time")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    throwIfDatabaseError(
      profileResult.error,
      {
        module: "experience.dashboard",
        schema: "user_service",
        table: "profiles",
        operation: "select dashboard profile",
      },
      "Your dashboard is temporarily unavailable.",
    );
    throwIfDatabaseError(
      preferenceResult.error,
      {
        module: "experience.dashboard",
        schema: "user_service",
        table: "notification_preferences",
        operation: "select dashboard notification preferences",
      },
      "Your dashboard is temporarily unavailable.",
    );
    const profile = profileResult.data;
    const preferences = preferenceResult.data;
    const recentTitles = await this.journals.getJournalTitles(userId, entries.slice(0, 3).map((entry) => entry.id));

    // Categorical self-reported moods are not numerical mental-health scores.
    // Keep the existing empty-chart contract instead of inventing a scalar trend.
    const moodTrend: Array<{ label: string; value: number }> = [];

    const weeklyDigest = entries.length
      ? [
          `You kept ${entries.length} private reflection${entries.length === 1 ? "" : "s"} close.`,
          "Open a saved reflection to revisit its model results.",
          entries.some((entry) => entry.tags.length > 0)
            ? "Your saved tags can help you revisit recurring themes."
            : "Adding a small tag can make recurring themes easier to revisit.",
        ]
      : [
          "Your reflection space is ready when you are.",
          "A few honest words are enough for a first entry.",
          "Your entries remain private by design.",
        ];

    return {
      userProfile: {
        name: asString((profile as DatabaseRow | null)?.display_name, "Friend"),
        streakDays: calculateStreak(entries),
        nextCheckIn: asString((preferences as DatabaseRow | null)?.reminder_time, "Whenever you are ready"),
        privacyStatus: "Private",
      },
      latestEntry: entries[0] ? { ...entries[0], title: recentTitles.get(entries[0].id) ?? "" } : null,
      journalEntries: entries.map((entry) => ({ ...entry, title: recentTitles.get(entry.id) ?? "" })),
      analysisInsights,
      moodTrend,
      riskTrend: [],
      weeklyDigest,
      quickActions: [
        { href: "/journal/new", title: "Write a reflection", description: "Private journal entry" },
        { href: "/buddy", title: "Talk with Buddy", description: "Gentle check-in conversation" },
        { href: "/tools/grounding", title: "Grounding exercise", description: "Breathing or sensory" },
        { href: "/insights/emotion", title: "Review patterns", description: "Mood and emotion trends" },
      ],
    };
  }

  private messageContent(row: DatabaseRow): string {
    return this.messageEnvelope(row).text;
  }
  private messageEnvelope(row:DatabaseRow):{text:string;generation?:import("@echo/contracts").GenerationStage;delivery?:import("@echo/contracts").TalkDelivery} {
    const raw=decryptText(row.content,this.encryption);
    if(row.role!=="user") {
      try {const value=JSON.parse(raw); if(value?.schemaVersion==='echo-buddy-talk-v1'&&typeof value.text==='string')return {text:value.text,delivery:value.delivery}; if(value?.schemaVersion==="echo-buddy-model-v1")
        return {text:value.text,generation:generationStageSchema.parse(value.generation)};
      } catch { /* Old encrypted text remains readable. */ }
    }
    return {text:raw};
  }

  async createBuddyConversation(userId: string) {
    if (!(await this.historyEnabled(userId))) throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to create a saved conversation.");
    if(this.localBuddy)return await this.localBuddy.create(userId);
    const title = "Buddy conversation";
    const { data, error } = await this.database.schema("buddy_service").rpc("create_conversation", {
      p_user_id: userId, p_title_ciphertext: encryptText(title, this.encryption),
      p_title_hashes: searchWords(title).map((word) => this.encryption.searchHashes(word)[0]),
    });
    if (error?.message.includes("BUDDY_HISTORY_DISABLED"))
      throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to create a saved conversation.");
    if (error || !data) throw databaseError("Buddy could not start a conversation.");
    return this.conversationSummary(data as DatabaseRow);
  }

  async renameBuddyConversation(userId: string, conversationId: string, title: string) {
    if(this.localBuddy)return this.localBuddy.mutate(userId,conversationId,c=>({...c,title}));
    await this.ownedConversation(userId, conversationId);
    const { data, error } = await this.database.schema("buddy_service").rpc("rename_conversation", {
      p_user_id: userId, p_conversation_id: conversationId,
      p_title_ciphertext: encryptText(title, this.encryption),
      p_title_hashes: searchWords(title).map((word) => this.encryption.searchHashes(word)[0]),
    });
    if (error?.message.includes("BUDDY_NOT_FOUND")) throw new NotFoundError("The Buddy conversation was not found.");
    if (error || !data) throw databaseError("Buddy conversation could not be renamed.");
    return this.conversationSummary(data as DatabaseRow);
  }

  async deleteBuddyConversation(userId: string, conversationId: string) {
    if(this.localBuddy){await this.realtime?.endConversation(userId,conversationId);return await this.localBuddy.remove(userId,conversationId);}
    await this.ownedConversation(userId, conversationId);
    const { data, error } = await this.database.schema("buddy_service").from("buddy_conversations")
      .delete().eq("id", conversationId).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw databaseError("Buddy conversation could not be deleted.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return { deleted: true };
  }

  async buddySession(userId: string, selectedConversationId?: string) {
    if (!selectedConversationId) {
      return { conversationId: null, persisted: false, messages: [{
        id: "welcome", role: "buddy", content: "I am here with you. What feels most present right now?", timestamp: "Now",
      }] };
    }
    if(this.localBuddy){const c=this.localBuddy.get(userId,selectedConversationId);return {conversationId:c.id,conversation:c,messages:c.messages};}
    const conversation = await this.ownedConversation(userId, selectedConversationId);
    const conversationId = asString(conversation.id);
    const { data, error } = await this.reader
      .schema("buddy_service")
      .from("buddy_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("role", { ascending: false })
      .order("id", { ascending: true });
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_messages",
        operation: "select conversation messages",
      },
      "Buddy messages could not be loaded.",
    );
    const messages = ((data ?? []) as DatabaseRow[]).map((row) => ({
      id: asString(row.id),
      role: row.role === "user" ? "user" : "buddy",
      content: this.messageContent(row),
      generation:this.messageEnvelope(row).generation,
      delivery:this.messageEnvelope(row).delivery,
      timestamp: new Date(asString(row.created_at)).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    }));
    // The owned conversation read also authorizes replay after a restart or reload.
    for (const message of messages) if (message.role === "buddy") this.rememberReply(userId, message.content);
    if (messages.length === 0) {
      messages.push({
        generation:undefined,
        delivery:undefined,
        id: "welcome",
        role: "buddy",
        content: "I am here with you. What feels most present right now?",
        timestamp: "Now",
      });
    }
    return { conversationId, conversation: this.conversationSummary(conversation), messages };
  }

  private readonly modelPageLeases:ModelPageLeases=new ModelPageLeases(
    (signal)=>this.ensureBuddyPrepared(signal),()=>this.unloadBuddyResources(true),Date.now,
    (user,session)=>appPresence()?.isClosed(user,session)??false,
  );
  async acquireModelLease(user:string,session:string,client:string){await this.validateTalk(user);return this.modelPageLeases.acquire(user,session,client);}
  async modelLeaseStatus(user:string,session:string,id:string){
    this.modelPageLeases.status(user,session,id);
    const preparation=await this.coreClient?.preparationStatus();
    // A release/expiry during the private status read must not revive an old lease.
    const lease=this.modelPageLeases.status(user,session,id);
    return {...lease,...(preparation?{preparation}:{})};
  }
  heartbeatModelLease(user:string,session:string,id:string){return this.modelPageLeases.heartbeat(user,session,id);}
  releaseModelLease(user:string,session:string,id:string){return this.modelPageLeases.release(user,session,id);}
  closeModelLeases(){return this.modelPageLeases.close();}
  private preparingBuddy?:Promise<void>;
  private runtimeState:{state:string;code?:string}={state:'unloaded'};
  buddyRuntimeStatus():{state:string;code?:string;releasePending:boolean;releaseAt?:string}{return {...this.runtimeState,...this.modelPageLeases.releaseStatus};}
  ensureBuddyPrepared(signal?:AbortSignal):Promise<void>{
    if(this.preparingBuddy)return this.preparingBuddy;
    const sessionId=randomUUID();
    this.runtimeState={state:'preparing'};
    this.preparingBuddy=(async()=>{
      try {await this.coreClient!.talk({task:'warm_chat',sessionId},signal);this.runtimeState={state:'ready'};}
      catch(error){this.runtimeState={state:'failed',code:(error as {code?:string}).code??'BUDDY_PREPARATION_FAILED'};throw error;}
      finally{await this.coreClient!.talk({task:'close',sessionId}).catch(()=>{});this.preparingBuddy=undefined;}
    })();
    return this.preparingBuddy;
  }
  async unloadBuddyRuntime(user:string){
    await this.validateTalk(user);
    if(this.modelPageLeases.count)throw new ConflictError('BUDDY_IN_USE','Buddy is still open in another page.');
    return this.unloadBuddyResources();
  }
  private async unloadBuddyResources(preserveStartup=false){
    await this.preparingBuddy?.catch(()=>{});
    // Socket closure releases the owner asynchronously. Never evict another active owner.
    for(let attempt=0;;attempt++){
      try{await this.coreClient!.talk({task:'unload',sessionId:randomUUID(),preserveStartup});break;}
      catch(error){if(attempt>=10 || !String((error as {code?:string}).code??error).includes('BUSY'))throw error;await new Promise(resolve=>setTimeout(resolve,200));}
    }
    this.runtimeState={state:'unloaded'};return this.buddyRuntimeStatus();
  }
  async requestBuddyPreparation(user:string){await this.validateTalk(user);void this.ensureBuddyPrepared().catch(()=>{});return this.buddyRuntimeStatus();}
  realtime?: import('./realtime-talk.js').RealtimeTalkHub;
  async validateTalk(user:string){await assertVoiceEnabled();if(!this.coreClient)throw new NotFoundError('Local Talk is unavailable.');return {historyEnabled:await this.historyEnabled(user)};}
  async startTalkContext(user:string,conversationId:string|undefined){const privacy=await this.validateTalk(user);if(conversationId){if(!privacy.historyEnabled)throw new ConflictError('BUDDY_HISTORY_DISABLED','Saved chats are read-only.');await this.ownedConversation(user,conversationId);}return {conversationId:conversationId??null,...privacy};}
  async acceptTalkTurn(user:string,content:string,conversationId:string|null,temporarySessionId:string,turnId:string){
    const storageEpoch=this.localBuddy?.generation(user);
    const privacy=await this.validateTalk(user);
    if(storageEpoch!==this.localBuddy?.generation(user))throw new ConflictError('LOCAL_DATA_DELETED','Local data was cleared during this turn.');
    const timestamp=new Date().toISOString();
    const message={id:turnId,role:'user' as const,content,timestamp};
    if(privacy.historyEnabled&&!this.localBuddy)return this.acceptHostedTalk(user,content,conversationId,turnId);
    if(privacy.historyEnabled){const initial=conversationId?this.localBuddy!.get(user,conversationId):await this.localBuddy!.create(user);const c=await this.localBuddy!.mutate(user,initial.id,c=>{if(c.messages.some(m=>m.id===turnId))throw new ConflictError('TURN_ALREADY_ACCEPTED','Turn already accepted.');c.messages.push(message);c.last_message_at=timestamp;c.preview=content.slice(0,120);if(c.messages.length===1)c.title=buddyTitle(content);return c;});return {conversationId:c.id,message,messages:c.messages.map(m=>({role:m.role==='user'?'user':'assistant',content:m.content})) as ChatTurn[]};}
    if(conversationId)throw new ConflictError('BUDDY_HISTORY_DISABLED','Saved chats are read-only.');
    const key=user+':'+temporarySessionId;const prior=this.temporary.get(key);const turns=prior&&prior.expires>Date.now()?prior.turns:[];
    turns.push({role:'user',content});while(turns.length>16||turns.reduce((a,t)=>a+t.content.length,0)>20000)turns.shift();
    if(this.temporary.size>=1000&&!this.temporary.has(key))this.temporary.delete(this.temporary.keys().next().value!);
    this.temporary.set(key,{turns,expires:Date.now()+1800000});return {conversationId:null,message,messages:[...turns]};
  }
  async generateTalk(user:string,sessionId:string,messages:ChatTurn[],signal:AbortSignal){
    await this.validateTalk(user);let urgent=requiresUrgentBuddySupport(messages.at(-1)!.content);
    let generated:any;
    const context=prepareBuddyContext(messages);
    messages=context.messages;
    if(!urgent){generated=await this.coreClient!.talk({task:'chat',sessionId,messages},signal);urgent=generated.supportRequired;}
    if(signal.aborted)throw new Error('Cancelled');
    const reply=urgent?buddyReply(messages.at(-1)!.content,true):generated?.reply;
    if(typeof reply!=='string'||!reply.trim()||reply.length>12000)throw new Error('No approved response');
    return {reply,supportRequired:urgent,model:generated?.model??{providerName:'application-support-rules',modelVersion:'buddy-support-v1'},quality:{...generated?.quality,backendContextReduction:context.reduction}};
  }
  async completeTalk(user:string,conversationId:string|null,temp:string,text:string,turnId:string,provenance:Record<string,unknown>){
    const storageEpoch=this.localBuddy?.generation(user);
    const privacy=await this.validateTalk(user);const message={id:randomUUID(),role:'buddy' as const,content:text,timestamp:new Date().toISOString()};
    if(storageEpoch!==this.localBuddy?.generation(user))throw new ConflictError('LOCAL_DATA_DELETED','Local data was cleared during this turn.');
    if(privacy.historyEnabled&&conversationId&&!this.localBuddy)return this.completeHostedTalk(user,conversationId,text,turnId,provenance);
    if(privacy.historyEnabled&&conversationId){await this.localBuddy!.mutate(user,conversationId,c=>{if(!c.messages.some(m=>m.id===turnId))throw new NotFoundError('Accepted turn was removed.');c.messages.push(message);c.supportRequired=Boolean(provenance.supportRequired);c.preview=text.slice(0,120);c.last_message_at=message.timestamp;const prior=c.provenance.find(r=>r.turnId===turnId);if(prior)Object.assign(prior,provenance);else c.provenance.push({turnId,...provenance});return c;});}
    else{const key=user+':'+temp,previous=this.temporary.get(key);this.temporary.set(key,{turns:[...(previous?.turns??[]),{role:'assistant' as const,content:text}].slice(-16),expires:Date.now()+1800000});conversationId=null;}
    this.rememberReply(user,text);return {message,conversationId};
  }
  async talkProvenance(user:string,conversationId:string|null,turnId:string,field:string,value:unknown){if(!conversationId)return;if(!this.localBuddy){await this.hostedTalkMetadata(user,conversationId,turnId,field,value);return;}await this.localBuddy.mutate(user,conversationId,c=>{let record=c.provenance.find(r=>r.turnId===turnId);if(!record){record={turnId};c.provenance.push(record);}if(field==='tts'){const models=Array.isArray(record.tts)?record.tts:[];if(!models.some((m:any)=>m.modelVersion===(value as any)?.modelVersion))models.push(value);record.tts=models;}else record[field]=value;return c;});}
  async talkDelivery(user:string,conversationId:string|null,messageId:string,delivery:import('@echo/contracts').TalkDelivery){if(!conversationId)return;if(!this.localBuddy){await this.hostedTalkMetadata(user,conversationId,messageId,'delivery',delivery);return;}await this.localBuddy.mutate(user,conversationId,c=>{const message=c.messages.find(m=>m.id===messageId&&m.role==='buddy');if(message)message.delivery=delivery;return c;});}
  private hostedTurns=new Map<string,{content:string;conversationId:string;metadata:Record<string,unknown>;expires:number}>();
  private hostedWrites:Promise<unknown>=Promise.resolve();
  private async acceptHostedTalk(user:string,content:string,selected:string|null,turnId:string){
    for(const [key,turn] of this.hostedTurns)if(turn.expires<Date.now())this.hostedTurns.delete(key);
    const key=user+':'+turnId;
    if(this.hostedTurns.has(key))throw new ConflictError('TURN_ALREADY_ACCEPTED','Turn already accepted.');
    if(this.hostedTurns.size>=1000)throw new ConflictError('TALK_BUSY','Too many pending turns.');
    const conversationId=selected??(await this.createBuddyConversation(user)).id;
    await this.ownedConversation(user,conversationId);
    const session=await this.buddySession(user,conversationId);
    this.hostedTurns.set(key,{content,conversationId,metadata:{},expires:Date.now()+1800000});
    const messages:ChatTurn[]=session.messages.filter(m=>m.id!=='welcome').map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
    messages.push({role:'user',content});
    return {conversationId,message:{id:turnId,role:'user' as const,content,timestamp:new Date().toISOString()},messages};
  }
  private async completeHostedTalk(user:string,conversationId:string,text:string,turnId:string,provenance:Record<string,unknown>){
    const turn=this.hostedTurns.get(user+':'+turnId);
    if(!turn||turn.conversationId!==conversationId)throw new NotFoundError('Accepted turn is unavailable.');
    const conversation=await this.ownedConversation(user,conversationId);
    const title=!conversation.last_message_at&&!conversation.title_manual?buddyTitle(turn.content):null;
    const envelope={schemaVersion:'echo-buddy-talk-v1',text,turnId,provenance:{...turn.metadata,...provenance}};
    const {error}=await this.database.schema('buddy_service').rpc('save_exchange',{
      p_user_id:user,p_conversation_id:conversationId,p_user_content:encryptText(turn.content,this.encryption),
      p_buddy_content:encryptText(JSON.stringify(envelope),this.encryption),p_urgent:Boolean(provenance.supportRequired),
      p_preview:encryptText(text.slice(0,120),this.encryption),p_auto_title:title?encryptText(title,this.encryption):null,
      p_user_hashes:searchWords(turn.content).map(w=>this.encryption.searchHashes(w)[0]),
      p_buddy_hashes:searchWords(text).map(w=>this.encryption.searchHashes(w)[0]),
      p_title_hashes:title?searchWords(title).map(w=>this.encryption.searchHashes(w)[0]):[]});
    if(error)throw databaseError('Buddy could not save this conversation.');
    const session=await this.buddySession(user,conversationId);
    const message=[...session.messages].reverse().find(m=>m.role==='buddy'&&m.content===text);
    if(!message)throw databaseError('Saved Buddy reply could not be loaded.');
    this.hostedTurns.delete(user+':'+turnId);this.rememberReply(user,text);
    return {message,conversationId};
  }
  private async hostedTalkMetadata(user:string,conversationId:string,identity:string,field:string,value:unknown){
    const pending=this.hostedTurns.get(user+':'+identity);
    if(pending){pending.metadata[field]=value;return;}
    const work=async()=>{
      if(!(await this.historyEnabled(user)))return;
      await this.ownedConversation(user,conversationId);
      const {data,error}=await this.database.schema('buddy_service').from('buddy_messages').select('id,content').eq('user_id',user).eq('conversation_id',conversationId).eq('role','assistant').order('created_at',{ascending:false}).limit(100);
      if(error)throw databaseError('Talk metadata could not be loaded.');
      for(const row of data??[]){let envelope;try{envelope=JSON.parse(decryptText(row.content,this.encryption));}catch{continue;}
        if(envelope.schemaVersion!=='echo-buddy-talk-v1'||(row.id!==identity&&envelope.turnId!==identity))continue;
        if(field==='delivery')envelope.delivery=value;else envelope.provenance={...envelope.provenance,[field]:value};
        const result=await this.database.schema('buddy_service').from('buddy_messages').update({content:encryptText(JSON.stringify(envelope),this.encryption)}).eq('id',row.id).eq('user_id',user).eq('conversation_id',conversationId);
        if(result.error)throw databaseError('Talk metadata could not be saved.');return;
      }
    };
    const next=this.hostedWrites.then(work,work);this.hostedWrites=next.catch(()=>undefined);await next;
  }
  async sendBuddyMessage(userId: string, content: string, selectedConversationId?: string,temporarySessionId?:string) {
    const storageEpoch=this.localBuddy?.generation(userId);
    const temporaryKey=userId+':'+(temporarySessionId??'legacy');
    const saving = await this.historyEnabled(userId);
    if (!saving && selectedConversationId) throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to continue a saved conversation.");
    // Preserve ownership verification before either model or prewritten support.
    if (selectedConversationId) await this.ownedConversation(userId, selectedConversationId);
    let urgent = requiresUrgentBuddySupport(content);
    let provenance:Record<string,unknown>|undefined;
    let reply: string;
    if (this.coreClient && !urgent) {
      // Loading is an asynchronous runtime operation, never a long-lived Send.
      if(process.env.ECHO_BUDDY_ENABLED==='true'&&this.runtimeState.state!=='ready'){
        if(this.runtimeState.state==='failed'){
          const code=this.runtimeState.code;
          throw new ExternalServiceError(typeof code==='string'&&/^BUDDY_[A-Z_]{1,70}$/.test(code)?code:'BUDDY_PREPARATION_FAILED','Buddy could not finish loading. Open the model loading details to check the failure.');
        }
        if(!this.preparingBuddy)void this.ensureBuddyPrepared().catch(()=>{});
        throw new ConflictError('BUDDY_LOADING','Buddy is still loading its local models. Your message has not been sent. Wait for the loading icon to finish, then press Send.');
      }
      const turns: ChatTurn[] = [];
      if (selectedConversationId) {
        await this.ownedConversation(userId, selectedConversationId);
        const session = await this.buddySession(userId, selectedConversationId);
        for (const item of session.messages) turns.push({ role: item.role === "user" ? "user" : "assistant", content: item.content });
      }
      if(!saving){const prior=this.temporary.get(temporaryKey);if(prior&&prior.expires>Date.now())turns.push(...prior.turns);}
      turns.push({ role: "user", content });
      const context=prepareBuddyContext(turns);
      // Text chat loads the CBT worker on demand; voice warm-up belongs to Talk/speech.
      const generated = await this.coreClient.chat(context.messages);
      provenance={model:generated.model,quality:{...generated.quality,backendContextReduction:context.reduction}};
      urgent = generated.supportRequired;
      reply = urgent ? buddyReply(content, true) : generated.reply!;
    } else reply = buddyReply(content, urgent);
    if(storageEpoch!==this.localBuddy?.generation(userId))throw new ConflictError('LOCAL_DATA_DELETED','Local data was cleared while Buddy was responding.');
    this.rememberReply(userId,reply);
    if (!saving) {
      const prior=this.temporary.get(temporaryKey);const turns=prior&&prior.expires>Date.now()?prior.turns:[];
      if(this.temporary.size>=1000)this.temporary.delete(this.temporary.keys().next().value!);
      this.temporary.set(temporaryKey,{turns:[...turns,{role:'user' as const,content},{role:'assistant' as const,content:reply}].slice(-16),expires:Date.now()+1800000});
      if (urgent && !this.localBuddy) {
        const { error } = await this.database.schema("user_service").from("audit_events").insert({
          user_id: userId, event_type: "buddy.urgent_language_detected",
          resource_type: "buddy_temporary_session", request_id: randomUUID(),
          metadata: { support_resources_shown: true },
        });
        if (error) throw databaseError("Buddy could not complete the safety check.");
      }
      return { conversationId: null, persisted: false, messages: [
        { id: randomUUID(), role: "user", content, timestamp: new Date().toISOString() },
        { id: randomUUID(), role: "buddy", content: reply, timestamp: new Date().toISOString() },
      ] };
    }
    if(this.localBuddy){const initial=selectedConversationId?this.localBuddy.get(userId,selectedConversationId):await this.localBuddy.create(userId);const timestamp=new Date().toISOString();const c=await this.localBuddy.mutate(userId,initial.id,c=>{c.messages.push({id:randomUUID(),role:'user',content,timestamp},{id:randomUUID(),role:'buddy',content:reply,timestamp});c.preview=reply.slice(0,120);c.last_message_at=timestamp;c.supportRequired=urgent;if(provenance)c.provenance.push(provenance);if(c.messages.length===2)c.title=buddyTitle(content);return c;});return {conversationId:c.id,persisted:true,conversation:c,messages:c.messages};}
    const conversation = selectedConversationId
      ? await this.ownedConversation(userId, selectedConversationId)
      : await this.ownedConversation(userId, (await this.createBuddyConversation(userId)).id);
    const conversationId = asString(conversation.id);
    const firstMessage = !conversation.last_message_at;
    const generatedTitle = firstMessage && !conversation.title_manual ? buddyTitle(content) : null;
    const { error } = await this.database.schema("buddy_service").rpc("save_exchange", {
      p_user_id: userId, p_conversation_id: conversationId,
      p_user_content: encryptText(content, this.encryption),
      p_buddy_content: encryptText(reply, this.encryption),
      p_urgent: urgent,
      p_preview: encryptText(reply.slice(0, 120), this.encryption),
      p_auto_title: generatedTitle ? encryptText(generatedTitle, this.encryption) : null,
      p_user_hashes: searchWords(content).map((word) => this.encryption.searchHashes(word)[0]),
      p_buddy_hashes: searchWords(reply).map((word) => this.encryption.searchHashes(word)[0]),
      p_title_hashes: generatedTitle ? searchWords(generatedTitle).map((word) => this.encryption.searchHashes(word)[0]) : [],
    });
    if (error?.message.includes("BUDDY_HISTORY_DISABLED"))
      throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to continue a saved conversation.");
    if (error?.message.includes("BUDDY_NOT_FOUND")) throw new NotFoundError("The Buddy conversation was not found.");
    throwIfDatabaseError(error, {
      module: "experience.buddy", schema: "buddy_service", table: "buddy_messages", operation: "save exchange",
    }, "Buddy could not save this conversation.");
    return this.buddySession(userId, conversationId);
  }

  async emotionInsights(userId: string) {
    const insights = await this.journals.dashboardInsights(userId, { range: "30d" });
    const latest = insights.latest;
    const emotionWheel = latest && "emotionDistribution" in latest && !latest.isSimulated ? latest.emotionDistribution.map(({ emotion, value }) => ({ label: emotion, mood: emotion, value: Math.round(value * 100) })) : [];
    return { emotionWheel, moodTrend: [], summary: emotionWheel.length ? "Emotion signals from your latest saved model analysis." : "No saved model emotion results yet." };
  }

  async completeGrounding(userId: string, input: { sessionId?: string; technique: string; durationSeconds: number; pace: string }) {
    const sessionId = input.sessionId ?? randomUUID();
    const inserted = await this.database
      .schema("grounding_service")
      .from("grounding_sessions")
      .insert({
        id: sessionId,
        user_id: userId,
        exercise_type: input.technique,
        duration_seconds: input.durationSeconds,
        completed: true,
        reflection: input.pace,
        completed_at: new Date().toISOString(),
      })
      .select("id, completed_at")
      .single();
    let data = inserted.data;
    if (inserted.error?.code === "23505") {
      const existing = await this.reader
        .schema("grounding_service")
        .from("grounding_sessions")
        .select("id, user_id, exercise_type, duration_seconds, reflection, completed, completed_at")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      throwIfDatabaseError(existing.error, {
        module: "experience.grounding", schema: "grounding_service", table: "grounding_sessions", operation: "load existing completed session",
      }, "The grounding session could not be confirmed.");
      if (!existing.data || existing.data.exercise_type !== input.technique ||
        existing.data.duration_seconds !== input.durationSeconds || existing.data.reflection !== input.pace ||
        existing.data.completed !== true) {
        throw new ConflictError("GROUNDING_SESSION_CONFLICT", "This practice key is already used for a different session.");
      }
      data = existing.data;
    } else throwIfDatabaseError(
      inserted.error,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "insert completed grounding session",
      },
      "The grounding session could not be recorded.",
    );
    if (!data) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The grounding session could not be recorded.");
    }
    const { count, error: countError } = await this.reader
      .schema("grounding_service")
      .from("grounding_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true);
    throwIfDatabaseError(
      countError,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "count completed grounding sessions",
      },
      "Grounding history could not be loaded.",
    );
    return { id: data.id, completedAt: data.completed_at, completedSessions: count ?? 1 };
  }

  async groundingHistory(userId: string) {
    const { data, error } = await this.reader
      .schema("grounding_service")
      .from("grounding_sessions")
      .select("id, exercise_type, duration_seconds, reflection, completed_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("completed_at", { ascending: false })
      .limit(250);
    throwIfDatabaseError(
      error,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "list completed grounding sessions",
      },
      "Grounding history could not be loaded.",
    );
    return (data ?? []).map((row) => ({
      id: row.id,
      type: row.exercise_type,
      duration: row.duration_seconds,
      pace: row.reflection,
      completedAt: row.completed_at,
    }));
  }

  async supportResources(query?: string, type?: string, country = "PH") {
    let builder = this.database
      .schema("grounding_service")
      .from("support_resources")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("country_code", country)
      .order("display_priority", { ascending: true });
    if (type && type !== "all") builder = builder.eq("support_resource_type", type);
    if (query) {
      const safeQuery = query.replace(/[%_,()]/g, " ").trim();
      if (safeQuery) {
        builder = builder.or(
          `organization_name.ilike.%${safeQuery}%,resource_name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`,
        );
      }
    }
    const { data, error } = await builder;
    throwIfDatabaseError(
      error,
      {
        module: "experience.supportResources",
        schema: "grounding_service",
        table: "support_resources",
        operation: "select verified support resources",
      },
      "Support resources are temporarily unavailable.",
    );
    return ((data ?? []) as DatabaseRow[]).filter(hasReviewableSource).map((row) => ({
      id: asString(row.id),
      type: asString(row.support_resource_type),
      organizationName: asString(row.organization_name),
      name: asString(row.resource_name),
      description: asString(row.description),
      phoneNumber: asString(row.phone_number) || null,
      smsNumber: asString(row.sms_number) || null,
      websiteUrl: asString(row.website_url) || null,
      availability: asString(row.availability_text),
      countryCode: asString(row.country_code),
      regionCode: asString(row.region_code) || null,
      lastVerifiedAt: asString(row.last_verified_at),
      verificationSource: asString(row.verification_source),
    }));
  }

  async buddyHistory(userId: string, options: { page: number; pageSize: number; query: string }) {
    if(this.localBuddy)return this.localBuddy.history(userId,options);
    if (options.query) {
      const words = searchWords(options.query);
      if (!words.length) return { conversations: [], total: 0, page: options.page, page_size: options.pageSize, pinsAvailable: true };
      const hashes = words.map((word) => this.encryption.searchHashes(word)[0]);
      const { data, error } = await this.database.schema("buddy_service").rpc("search_history", {
        p_user_id: userId, p_hashes: hashes, p_page: options.page, p_page_size: options.pageSize,
      });
      if (error) throw databaseError("Buddy history could not be searched.");
      const rows = (data ?? []) as DatabaseRow[];
      return { conversations: rows.map((row) => this.conversationSummary(row)),
        total: Number(rows[0]?.total ?? 0), page: options.page, page_size: options.pageSize, pinsAvailable: true };
    }
    const readPage = async (pinsAvailable: boolean) => {
      let request = this.reader
        .schema("buddy_service")
        .from("buddy_conversations")
        .select(pinsAvailable
          ? "id, title, title_ciphertext, preview_ciphertext, archived, pinned_at, last_message_at, created_at"
          : "id, title, title_ciphertext, preview_ciphertext, archived, last_message_at, created_at", { count: "exact" })
        .eq("user_id", userId);
      if (pinsAvailable) request = request.order("pinned_at", { ascending: false, nullsFirst: false });
      return request
        .order("last_message_at", { ascending: false })
        .order("id", { ascending: false })
        .range((options.page - 1) * options.pageSize, options.page * options.pageSize - 1);
    };
    let pinsAvailable = true;
    let { data, count, error } = await readPage(true);
    // shortcut: keep history readable before the pin migration; remove this fallback once every database has it.
    if (error?.code === "42703" && error.message.includes("pinned_at")) {
      pinsAvailable = false;
      ({ data, count, error } = await readPage(false));
    }
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_conversations",
        operation: "select conversation history",
      },
      "Buddy history could not be loaded.",
    );
    return { conversations: ((data ?? []) as unknown as DatabaseRow[]).map((row) => this.conversationSummary(row)), total: count ?? 0, page: options.page, page_size: options.pageSize, pinsAvailable };
  }

  private async ownedConversation(userId: string, conversationId: string): Promise<DatabaseRow> {
    if(this.localBuddy)return this.localBuddy.get(userId,conversationId);
    const { data, error } = await this.reader.schema("buddy_service").from("buddy_conversations")
      .select("*").eq("id", conversationId).eq("user_id", userId).maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy conversation could not be loaded.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return data as DatabaseRow;
  }

  async pinBuddyConversation(userId: string, conversationId: string, pinned: boolean) {
    if(this.localBuddy)return this.localBuddy.mutate(userId,conversationId,c=>({...c,pinned_at:pinned?new Date().toISOString():null}));
    const { data, error } = await this.database.schema("buddy_service").from("buddy_conversations")
      .update({ pinned_at: pinned ? new Date().toISOString() : null })
      .eq("id", conversationId).eq("user_id", userId)
      .select("id,pinned_at").maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy conversation could not be updated.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return data;
  }

  async ensureOwnedConversation(userId: string, conversationId: string) {
    if(this.localBuddy){this.localBuddy.get(userId,conversationId);return;}
    const { data, error } = await this.reader
      .schema("buddy_service")
      .from("buddy_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_conversations",
        operation: "select owned conversation",
      },
      "Buddy is temporarily unavailable.",
    );
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
  }
}
