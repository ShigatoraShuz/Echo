import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, ConflictError, ExternalServiceError, ValidationError } from "../../shared/errors/app-error.js";
import { currentRequestId } from "../../shared/request-context.js";

export const ELIGIBILITY_RULE_VERSION = "echo-adult-18-v1";
export const PASSWORD_POLICY_VERSION = "supabase-echo-v1";
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const DRAFT_TTL_MS = 30 * 60_000;

type Row = Record<string, unknown>;

export interface DraftCredentials {
  token: string;
  csrf: string;
}

function dateOnlyAge(value: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError({ birthday: ["Enter a valid birthday."] });
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== value) {
    throw new ValidationError({ birthday: ["Enter a valid birthday."] });
  }
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function safePolicyMarkdown(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\[[^\]]*\]\((?:javascript|data):[^)]*\)/gi, "")
    .slice(0, 80_000);
}

export class RegistrationService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly publicAuthSource: SupabaseClient | (() => SupabaseClient),
    private readonly secret: string,
    private readonly frontendUrl: string,
  ) {}

  private get publicAuth(): SupabaseClient {
    return typeof this.publicAuthSource === "function" ? this.publicAuthSource() : this.publicAuthSource;
  }

  private hash(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("hex");
  }
  private credentials(): DraftCredentials {
    return { token: randomBytes(32).toString("base64url"), csrf: randomBytes(24).toString("base64url") };
  }
  private async draft(token: string): Promise<Row> {
    const { data, error } = await this.database.rpc("echo_registration_get_draft", {
      draft_token_hash: this.hash(token),
    });
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Registration could not be loaded.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new ConflictError("SIGNUP_DRAFT_EXPIRED", "This signup has expired. Please begin again.");
    return row as Row;
  }
  private async rotate(row: Row, updates: Row): Promise<DraftCredentials> {
    const next = this.credentials();
    const { data, error } = await this.database.rpc("echo_registration_update_draft", {
      draft_id: row.id,
      expected_token_hash: row.token_hash,
      expected_state: row.state,
      changes: {
        ...updates,
        token_hash: this.hash(next.token),
        csrf_hash: this.hash(next.csrf),
      },
    });
    if (error || data !== true)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Registration could not be advanced.");
    return next;
  }
  verifyCsrf(row: Row, csrf: string): void {
    if (!csrf || row.csrf_hash !== this.hash(csrf))
      throw new ValidationError({ csrf: ["The signup request could not be verified."] });
  }

  async activePolicies(): Promise<Row[]> {
    const { data, error } = await this.database.rpc("echo_registration_active_policies");
    if (error || !data || data.length !== 3)
      throw new ExternalServiceError("POLICIES_UNAVAILABLE", "Signup policies are unavailable.");
    return (data as Row[]).map((item) => ({
      ...item,
      sanitized_markdown: safePolicyMarkdown(item.sanitized_markdown),
    }));
  }

  async startEligibility(birthday: string): Promise<{ eligible: boolean; credentials?: DraftCredentials }> {
    const age = dateOnlyAge(birthday);
    if (age < 18) return { eligible: false };
    if (age > 120) throw new ValidationError({ birthday: ["Check the birthday and try again."] });
    const credentials = this.credentials();
    const now = new Date();
    const { error } = await this.database.rpc("echo_registration_create_draft", {
      new_token_hash: this.hash(credentials.token),
      new_csrf_hash: this.hash(credentials.csrf),
      new_rule_version: ELIGIBILITY_RULE_VERSION,
      new_expires_at: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    });
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Signup could not be started.");
    return { eligible: true, credentials };
  }

  async acceptAgreements(
    token: string,
    csrf: string,
    input: {
      reviewedDocumentIds: string[];
      termsAccepted: boolean;
      privacyAccepted: boolean;
      aiNoticeAccepted: boolean;
      optionalAiAnalysis: boolean;
    },
  ): Promise<DraftCredentials> {
    const draft = await this.draft(token);
    this.verifyCsrf(draft, csrf);
    if (!input.termsAccepted || !input.privacyAccepted || !input.aiNoticeAccepted) {
      throw new ValidationError({ agreements: ["Review and acknowledge all required documents."] });
    }
    const policies = await this.activePolicies();
    if (policies.some((p) => !input.reviewedDocumentIds.includes(String(p.id)))) {
      throw new ConflictError("POLICY_REVIEW_REQUIRED", "Review every current policy before continuing.");
    }
    const byType = Object.fromEntries(policies.map((p) => [p.document_type, p.id]));
    return this.rotate(draft, {
      state: "account",
      terms_document_id: byType.terms_of_use,
      privacy_document_id: byType.privacy_notice,
      ai_notice_document_id: byType.ai_analysis_notice,
      required_agreements_accepted_at: new Date().toISOString(),
      optional_ai_analysis_enabled: input.optionalAiAnalysis,
    });
  }

  async registerEmail(token: string, csrf: string, email: string, password: string): Promise<DraftCredentials | null> {
    const draft = await this.draft(token);
    this.verifyCsrf(draft, csrf);
    if (draft.state !== "account")
      throw new ConflictError("SIGNUP_STEP_REQUIRED", "Complete the previous signup steps first.");
    if (!PASSWORD_PATTERN.test(password))
      throw new ValidationError({ password: ["Use 8+ characters with lowercase, uppercase, and a number."] });
    const reservation = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const { data: reserved, error: reserveError } = await this.database.rpc("echo_registration_update_draft", {
      draft_id: draft.id,
      expected_token_hash: draft.token_hash,
      expected_state: "account",
      changes: {
        email: normalizedEmail,
        reservation_id: reservation,
        state: "verification_pending",
        verification_sent_at: new Date().toISOString(),
      },
    });
    if (reserveError || reserved !== true)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Email registration could not be prepared.");
    let failure: { code?: string; status?: number } | null = null;
    let immediate = false;
    try {
      const { data, error } = await this.publicAuth.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { signup_reservation: reservation },
          emailRedirectTo: `${this.frontendUrl.replace(/\/$/, "")}/callback?next=/onboarding`,
        },
      });
      failure = error ?? (data.user ? null : {});
      immediate = Boolean(data.session);
    } catch {
      failure = {};
    }
    if (failure && !["user_already_exists", "email_exists"].includes(failure.code ?? "")) {
      console.error(JSON.stringify({
        requestId: currentRequestId(),
        event: "registration_auth_signup_failed",
        providerCode: failure.code ?? "unknown",
        providerStatus: failure.status ?? null,
      }));
      const { data: restored, error: restoreError } = await this.database.rpc("echo_registration_update_draft", {
        draft_id: draft.id,
        expected_token_hash: draft.token_hash,
        expected_state: "verification_pending",
        changes: { state: "account", email: null, reservation_id: null, verification_sent_at: null },
      });
      if (restoreError || restored !== true) {
        throw new ExternalServiceError(
          "EMAIL_SIGNUP_UNCERTAIN",
          "We could not confirm registration. Check your inbox; if no email arrives, start signup again.",
        );
      }
      if (failure.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(failure.code ?? "")) {
        throw new AppError({ statusCode: 429, code: "EMAIL_SIGNUP_RATE_LIMITED", message: "Too many signup requests. Please wait before trying again." });
      }
      if (failure.code === "email_address_not_authorized") {
        throw new ExternalServiceError("EMAIL_DELIVERY_NOT_CONFIGURED", "Email registration is unavailable until email delivery is configured.");
      }
      throw new ExternalServiceError("EMAIL_SIGNUP_FAILED", "Registration is temporarily unavailable. Please try again later.");
    }
    // Auth already consumed the draft when email confirmation is disabled.
    if (immediate || ["user_already_exists", "email_exists"].includes(failure?.code ?? "")) return null;
    return this.rotate({ ...draft, state: "verification_pending" }, { state: "verification_pending" });
  }

  async registrationStatus(token: string) {
    const draft = await this.draft(token);
    const sentAt = typeof draft.verification_sent_at === "string" ? new Date(draft.verification_sent_at) : null;
    const resendAt = sentAt ? new Date(sentAt.getTime() + 60_000) : null;
    return {
      state: draft.state,
      verificationPending: draft.state === "verification_pending",
      resendAvailableAt: resendAt?.toISOString() ?? null,
      expiresAt: draft.expires_at,
    };
  }

  async resendVerification(token: string, csrf: string): Promise<void> {
    const draft = await this.draft(token);
    this.verifyCsrf(draft, csrf);
    if (draft.state !== "verification_pending" || typeof draft.email !== "string") {
      throw new ConflictError("VERIFICATION_NOT_PENDING", "There is no email verification to resend.");
    }
    const sentAt = typeof draft.verification_sent_at === "string" ? new Date(draft.verification_sent_at).getTime() : 0;
    if (Date.now() < sentAt + 60_000) {
      throw new ConflictError("RESEND_COOLDOWN", "Please wait before requesting another verification email.");
    }
    const { error } = await this.publicAuth.auth.resend({
      type: "signup",
      email: draft.email,
      options: { emailRedirectTo: `${this.frontendUrl.replace(/\/$/, "")}/callback?next=/onboarding` },
    });
    if (error) throw new ExternalServiceError("EMAIL_RESEND_FAILED", "The verification email could not be resent.");
    const { data: updated, error: updateError } = await this.database.rpc("echo_registration_update_draft", {
      draft_id: draft.id,
      expected_token_hash: draft.token_hash,
      expected_state: "verification_pending",
      changes: { verification_sent_at: new Date().toISOString() },
    });
    if (updateError || updated !== true)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Verification status could not be updated.");
  }
}
