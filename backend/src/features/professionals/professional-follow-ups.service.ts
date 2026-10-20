import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptText, encryptText, type EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { AuthorizationError, ConflictError, ExternalServiceError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";

type Row = Record<string, unknown>;
export interface FollowUpInput { title: string; dueAt: string }
function fail(error: { message: string }): never {
  switch (error.message) {
    case "INVALID_FOLLOW_UP": throw new ValidationError();
    case "FOLLOW_UP_CONFLICT":
    case "INVALID_CASE_TRANSITION": throw new ConflictError("FOLLOW_UP_CONFLICT", "Refresh the case before changing this follow-up.");
    case "MEMBERSHIP_REQUIRED": throw new AuthorizationError();
    case "REQUEST_NOT_FOUND": throw new NotFoundError("The resource is unavailable.");
    default: throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Follow-ups are temporarily unavailable.");
  }
}

export class ProfessionalFollowUpService {
  constructor(private readonly database: SupabaseClient, private readonly encryption: EncryptionService) {}

  private project(row: Row) {
    let title: string;
    try { title = decryptText(row.title_encrypted, this.encryption); }
    catch { throw new ExternalServiceError("FOLLOW_UP_UNAVAILABLE", "The follow-up could not be opened."); }
    return { id: row.id, caseId: row.request_id, organizationId: row.organization_id, title,
      dueAt: row.due_at, status: row.status, responsibleUserId: row.responsible_user_id,
      revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at };
  }

  async list(actor: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("list_follow_ups", { p_actor: actor, p_request_id: requestId });
    if (error) fail(error);
    const page = data as { items: Row[]; total: number; hasMore: boolean; limit: number };
    return { items: page.items.map((row) => this.project(row)), total: page.total, hasMore: page.hasMore, limit: page.limit };
  }

  async create(actor: string, requestId: string, input: FollowUpInput & { submissionId: string }) {
    const { data, error } = await this.database.schema("professional_service").rpc("create_follow_up", {
      p_actor: actor, p_request_id: requestId, p_title_encrypted: encryptText(input.title, this.encryption),
      p_due_at: input.dueAt, p_submission_id: input.submissionId,
    });
    if (error) fail(error);
    const item = this.project(data as Row);
    // An idempotency key may replay only the original intent, never disclose an old title.
    if (item.title !== input.title || Date.parse(String(item.dueAt)) !== Date.parse(input.dueAt)) {
      throw new ConflictError("FOLLOW_UP_CONFLICT", "This submission has already been recorded. Refresh the case.");
    }
    return { followUp: item };
  }

  async update(actor: string, requestId: string, id: string, expectedRevision: number, input: FollowUpInput | null) {
    const { data, error } = await this.database.schema("professional_service").rpc("update_follow_up", {
      p_actor: actor, p_request_id: requestId, p_follow_up_id: id, p_expected_revision: expectedRevision,
      p_complete: input === null, p_title_encrypted: input ? encryptText(input.title, this.encryption) : null, p_due_at: input?.dueAt ?? null,
    });
    if (error) fail(error);
    return { followUp: this.project(data as Row) };
  }
}
