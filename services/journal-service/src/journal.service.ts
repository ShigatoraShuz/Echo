import type { OwnedDatabase } from "@echo/service-core";
import { ServiceError } from "@echo/service-core";
import type { Encryption, EncryptedPayload } from "./encryption.js";

export type JournalInput = { title: string; body: string; mood: "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry"; emotions: string[]; tags: string[]; privacyStatus: "private" | "shared"; analysisConsent: boolean };
export type JournalDraftInput = JournalInput;
type Row = Record<string, unknown>;

const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const bytea = (value: string) => `\\x${Buffer.from(value, "base64").toString("hex")}`;
const fromBytea = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Encrypted journal data is invalid.");
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
};

export class JournalService {
  constructor(private database: OwnedDatabase, private encryption: Encryption) {}
  private encrypt(input: Pick<JournalInput, "title" | "body">): EncryptedPayload { return this.encryption.encrypt(JSON.stringify({ title: input.title, body: input.body })); }
  private decrypt(row: Row) {
    const parsed: unknown = JSON.parse(this.encryption.decrypt({ ciphertext: fromBytea(row.content_ciphertext), iv: fromBytea(row.encryption_iv), authenticationTag: fromBytea(row.encryption_auth_tag), keyVersion: Number(row.encryption_key_version) }));
    if (!parsed || typeof parsed !== "object" || typeof (parsed as Row).title !== "string" || typeof (parsed as Row).body !== "string") throw new Error("Encrypted journal data is invalid.");
    return parsed as { title: string; body: string };
  }
  private response(row: Row) {
    const clear = this.decrypt(row);
    return { id: text(row.id), ...clear, excerpt: clear.body.slice(0, 180), mood: text(row.mood, "neutral"), emotions: strings(row.emotions), tags: strings(row.tags), privacy_status: text(row.privacy_status, "private"), analysis_consent: row.analysis_consent === true, risk_score: 0, risk_band: "low" as const, summary: "Analysis is available from the analysis endpoint.", perspective: null, created_at: text(row.created_at), updated_at: text(row.updated_at) };
  }
  async list(userId: string) {
    const { data, error } = await this.database.from("journals").select("*").eq("user_id", userId).is("deleted_at", null).order("entry_date", { ascending: false });
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    return ((data ?? []) as Row[]).map((row) => this.response(row));
  }
  async get(userId: string, journalId: string) {
    const { data, error } = await this.database.from("journals").select("*").eq("id", journalId).eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    if (!data) throw new ServiceError(404, "NOT_FOUND", "The journal entry was not found.");
    return this.response(data as Row);
  }
  async analysisInput(userId: string, journalId: string) {
    const journal = await this.get(userId, journalId);
    return { journalId: journal.id, journalText: journal.body, analysisConsent: journal.analysis_consent };
  }
  async create(userId: string, input: JournalInput) {
    const encrypted = this.encrypt(input);
    const { data, error } = await this.database.from("journals").insert({ user_id: userId, title: null, content: null, content_ciphertext: bytea(encrypted.ciphertext), encryption_iv: bytea(encrypted.iv), encryption_auth_tag: bytea(encrypted.authenticationTag), encryption_key_version: encrypted.keyVersion, word_count: input.body.trim() ? input.body.trim().split(/\s+/).length : 0, mood: input.mood, emotions: input.emotions, tags: input.tags, privacy_status: input.privacyStatus, analysis_consent: input.analysisConsent }).select("*").single();
    if (error || !data) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The journal could not be saved.");
    return this.response(data as Row);
  }
  async update(userId: string, journalId: string, input: Partial<JournalInput>) {
    const current = await this.get(userId, journalId);
    const next: JournalInput = { title: input.title ?? current.title, body: input.body ?? current.body, mood: input.mood ?? current.mood as JournalInput["mood"], emotions: input.emotions ?? current.emotions, tags: input.tags ?? current.tags, privacyStatus: input.privacyStatus ?? current.privacy_status as JournalInput["privacyStatus"], analysisConsent: input.analysisConsent ?? current.analysis_consent };
    const encrypted = this.encrypt(next);
    const { data, error } = await this.database.from("journals").update({ title: null, content: null, content_ciphertext: bytea(encrypted.ciphertext), encryption_iv: bytea(encrypted.iv), encryption_auth_tag: bytea(encrypted.authenticationTag), encryption_key_version: encrypted.keyVersion, word_count: next.body.trim() ? next.body.trim().split(/\s+/).length : 0, mood: next.mood, emotions: next.emotions, tags: next.tags, privacy_status: next.privacyStatus, analysis_consent: next.analysisConsent }).eq("id", journalId).eq("user_id", userId).select("*").maybeSingle();
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The journal could not be updated.");
    if (!data) throw new ServiceError(404, "NOT_FOUND", "The journal entry was not found.");
    return this.response(data as Row);
  }
  async remove(userId: string, journalId: string) {
    const { error, count } = await this.database.from("journals").delete({ count: "exact" }).eq("id", journalId).eq("user_id", userId);
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The journal could not be deleted.");
    if (!count) throw new ServiceError(404, "NOT_FOUND", "The journal entry was not found.");
  }
  private draft(row: Row) { const clear = this.decrypt(row); return { id: text(row.id, text(row.user_id)), ...clear, mood: text(row.mood, "calm"), emotions: strings(row.emotions), tags: strings(row.tags), privacy_status: text(row.privacy_status, "private"), analysis_consent: row.analysis_consent === true, updated_at: text(row.updated_at) }; }
  async saveDraft(userId: string, input: JournalDraftInput) {
    const encrypted = this.encrypt(input);
    const { data, error } = await this.database.from("journal_drafts").upsert({ user_id: userId, content_ciphertext: bytea(encrypted.ciphertext), encryption_iv: bytea(encrypted.iv), encryption_auth_tag: bytea(encrypted.authenticationTag), encryption_key_version: encrypted.keyVersion, mood: input.mood, emotions: input.emotions, tags: input.tags, privacy_status: input.privacyStatus, analysis_consent: input.analysisConsent }, { onConflict: "user_id" }).select("*").single();
    if (error || !data) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Your draft could not be saved.");
    return this.draft(data as Row);
  }
  async getDraft(userId: string) { const { data, error } = await this.database.from("journal_drafts").select("*").eq("user_id", userId).maybeSingle(); if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Your draft could not be loaded."); return data ? this.draft(data as Row) : null; }
  async deleteDraft(userId: string) { const { error } = await this.database.from("journal_drafts").delete().eq("user_id", userId); if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Your draft could not be removed."); }
}
