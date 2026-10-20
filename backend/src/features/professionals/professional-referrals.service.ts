import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, ExternalServiceError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";

function fail(error: { message: string }): never {
  switch (error.message) {
    case "INVALID_REFERRAL": throw new ValidationError();
    case "REFERRAL_CONFLICT":
    case "INVALID_CASE_TRANSITION": throw new ConflictError("REFERRAL_CONFLICT", "Refresh the case before changing this referral.");
    case "MEMBERSHIP_REQUIRED":
    case "ASSIGNMENT_REQUIRED": throw new AuthorizationError();
    case "REQUEST_NOT_FOUND": throw new NotFoundError("The resource is unavailable.");
    default: throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Referrals are temporarily unavailable.");
  }
}
export class ProfessionalReferralService {
  constructor(private readonly database: SupabaseClient) {}
  async create(actor: string, requestId: string, name: string, url: string | null, submissionId: string = randomUUID()) {
    const { data, error } = await this.database.schema("professional_service").rpc("record_referral", { p_request_id: requestId, p_actor: actor, p_name: name, p_url: url, p_submission_id: submissionId });
    if (error) fail(error);
    return { referralId: data.id as string, status: data.status as string, revision: data.revision as number, delivery: "not_integrated" as const };
  }
  async list(actor: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("list_referrals", { p_request_id: requestId, p_actor: actor });
    if (error) fail(error);
    return data;
  }
  async setStatus(actor: string, requestId: string, id: string, status: "completed" | "canceled", expectedRevision: number) {
    const { data, error } = await this.database.schema("professional_service").rpc("set_referral_status", { p_request_id: requestId, p_referral_id: id, p_actor: actor, p_status: status, p_expected_revision: expectedRevision });
    if (error) fail(error);
    return { referralId: data.id as string, status: data.status as string, revision: data.revision as number, delivery: "not_integrated" as const };
  }
}
