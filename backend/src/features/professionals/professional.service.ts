
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  decryptText,
  encryptText,
  type EncryptionService,
} from "../../infrastructure/encryption/encryption.service.js";
import {
  AppError,
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { JournalService } from "../journals/journals.service.js";
import type { ExperienceService } from "../experience/experience.service.js";
import type { AuthenticatedUser } from "../../shared/types/authenticated-user.js";
import { ProfessionalCredentialService } from "./professional-credentials.service.js";
import { ProfessionalFollowUpService } from "./professional-follow-ups.service.js";
import { ProfessionalReferralService } from "./professional-referrals.service.js";
import { ProfessionalNotificationService } from "./professional-notifications.service.js";
import { professionalQueueQuery, type ProfessionalQueueQuery } from "./professional-queue.contract.js";

type Row = Record<string, unknown>;
type ProfessionalRole = "counselor" | "psychologist" | "social_worker" | "coordinator" | "org_admin";
const CLINICAL_ROLES = new Set<ProfessionalRole>(["counselor", "psychologist", "social_worker"]);
const PROFESSIONAL_ROLES = new Set<string>([...CLINICAL_ROLES, "coordinator", "org_admin"]);
export const PROFESSIONAL_CONSENT_VERSION = "professional-request-v1";

function currentCredential(expiresAt: string): boolean {
  const parsed = Date.parse(expiresAt);
  return /^\d{4}-\d{2}-\d{2}$/.test(expiresAt) && Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === expiresAt && expiresAt >= new Date().toISOString().slice(0, 10);
}

function value(row: Row, key: string): string {
  return typeof row[key] === "string" ? (row[key] as string) : "";
}

function optional(row: Row, key: string): string | null {
  return typeof row[key] === "string" ? (row[key] as string) : null;
}

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function logDatabaseError(operation: string, error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}) {
  console.error(`[professional.${operation}] Supabase query failed`, {
    code: error.code,
  });
}

function sharingActive(row: Row): boolean {
  return !row.sharing_revoked_at && new Date(value(row, "sharing_expires_at")).getTime() > Date.now();
}

function mapOrganization(row: Row) {
  return {
    id: value(row, "id"),
    slug: value(row, "slug"),
    name: value(row, "name"),
    description: value(row, "description"),
    serviceHours: value(row, "service_hours"),
    status: value(row, "status"),
  };
}

function mapRequest(row: Row) {
  return {
    id: value(row, "id"),
    organizationId: value(row, "organization_id"),
    status: value(row, "status"),
    assignedTo: optional(row, "assigned_to"),
    createdAt: value(row, "created_at"),
    updatedAt: value(row, "updated_at"),
    preferredTime: "",
    sharingActive: sharingActive(row),
    sharedJournalCount: Array.isArray(row.shared_journal_ids) ? row.shared_journal_ids.length : 0,
  };
}

export class ProfessionalService {
  readonly credentials: ProfessionalCredentialService;
  readonly followUps: ProfessionalFollowUpService;
  readonly referrals: ProfessionalReferralService;
  readonly notifications: ProfessionalNotificationService;

  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly journals: JournalService,
    private readonly directory?: Pick<ExperienceService, "supportResources">,
  ) {
    this.credentials = new ProfessionalCredentialService(database, encryption);
    this.followUps = new ProfessionalFollowUpService(database, encryption);
    this.referrals = new ProfessionalReferralService(database);
    this.notifications = new ProfessionalNotificationService(database);
  }

  async listOrganizations() {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("id,slug,name,description,service_hours,status")
      .eq("status", "active")
      .order("name");

    if (error) {
      logDatabaseError("listOrganizations", error);
      throw databaseError("Professional organizations could not be loaded.");
    }

    return { organizations: ((data ?? []) as Row[]).map(mapOrganization) };
  }

  async crisisSupport(userId: string, requestId: string) {
    await this.assignedCase(userId, requestId);
    if (!this.directory) throw databaseError("The reviewed support directory is temporarily unavailable.");
    const resources = await this.directory.supportResources(undefined, "crisis_hotline", "PH");
    const row = await this.assignedCase(userId, requestId);
    const { error } = await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: row.organization_id, request_id: requestId, actor_user_id: userId, action: "crisis.resources_viewed",
    });
    if (error) throw databaseError("The reviewed support directory is temporarily unavailable.");
    return { resources, country: "PH", continuouslyMonitored: false,
      escalation: { available: false, reasonCode: "ORGANIZATION_PROTOCOL_REQUIRED" } };
  }

  async memberships(userId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,organization_id,role,status,display_name,credential_label,credential_expires_at")
      .eq("user_id", userId)
      .order("created_at");

    if (error) {
      logDatabaseError("memberships", error);
      throw databaseError("Professional access could not be checked.");
    }

    const memberships = (data ?? []) as Row[];
    if (memberships.length === 0) return { userId, memberships: [] };

    const { data: organizations, error: organizationError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("id,slug,name,description,service_hours,status")
      .in(
        "id",
        memberships.map((item) => value(item, "organization_id")),
      );

    if (organizationError) {
      logDatabaseError("memberships.organizations", organizationError);
      throw databaseError("Organizations could not be loaded.");
    }

    const byId = new Map(
      ((organizations ?? []) as Row[]).map((item) => [
        value(item, "id"),
        mapOrganization(item),
      ]),
    );

    return {
      userId,
      memberships: memberships.map((item) => ({
        id: value(item, "id"),
        organizationId: value(item, "organization_id"),
        organization: byId.get(value(item, "organization_id")) ?? null,
        role: value(item, "role"),
        status: value(item, "status"),
        displayName: value(item, "display_name"),
        credentialLabel: optional(item, "credential_label"),
        credentialExpiresAt: optional(item, "credential_expires_at"),
        accessState:
          byId.get(value(item, "organization_id"))?.status === "suspended"
            ? "suspended_organization"
            : byId.get(value(item, "organization_id"))?.status !== "active"
              ? "pending_organization"
              : value(item, "status") === "suspended"
                ? "suspended_membership"
                : value(item, "status") !== "active" || !PROFESSIONAL_ROLES.has(value(item, "role"))
                  ? "pending_membership"
                  : CLINICAL_ROLES.has(value(item, "role") as ProfessionalRole) &&
                      !currentCredential(value(item, "credential_expires_at"))
                    ? "credential_expired"
                    : "active",
      })),
    };
  }

  private async membership(userId: string, organizationId: string, clinical = false): Promise<Row> {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,role,status,credential_expires_at")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      logDatabaseError("membership", error);
      throw databaseError("Professional access could not be checked.");
    }

    const member = data as Row | null;

    if (!member || member.status !== "active" || !PROFESSIONAL_ROLES.has(value(member, "role"))) {
      throw new AuthorizationError("You do not have active access to this organization.");
    }

    const { data: organization, error: organizationError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("status")
      .eq("id", organizationId)
      .maybeSingle();

    if (organizationError) {
      logDatabaseError("membership.organization", organizationError);
      throw databaseError("Organization access could not be checked.");
    }

    if (organization?.status !== "active") {
      throw new AuthorizationError("This organization is not accepting professional access.");
    }

    if (
      CLINICAL_ROLES.has(value(member, "role") as ProfessionalRole) &&
      !currentCredential(value(member, "credential_expires_at"))
    ) {
      throw new AuthorizationError("Your professional credential has expired.");
    }

    if (clinical) {
      const role = value(member, "role") as ProfessionalRole;
      const expires = value(member, "credential_expires_at");

      if (!CLINICAL_ROLES.has(role) || !currentCredential(expires)) {
        throw new AuthorizationError("An active reviewed practitioner credential is required.");
      }
    }

    return member;
  }

  async createRequest(
    userId: string,
    input: {
      organizationId: string;
      summary: string;
      preferredTime: string;
      journalIds: string[];
    },
  ) {
    const ids = [...new Set(input.journalIds)];

    if (ids.length !== input.journalIds.length) {
      throw new ConflictError("DUPLICATE_JOURNAL", "Choose each journal only once.");
    }

    const snapshots = await Promise.all(
      ids.map(async (journalId) => {
        const journal = await this.journals.get(userId, journalId);

        return {
          journalId,
          titleEncrypted: encryptText(journal.title, this.encryption),
          bodyEncrypted: encryptText(journal.body, this.encryption),
        };
      }),
    );

    const { data, error } = await this.database.schema("professional_service").rpc("create_request", {
      p_organization_id: input.organizationId,
      p_user_id: userId,
      p_summary_encrypted: encryptText(input.summary, this.encryption),
      p_preferred_time_encrypted: encryptText(input.preferredTime, this.encryption),
      p_consent_version: PROFESSIONAL_CONSENT_VERSION,
      p_shared_items: snapshots,
    });

    if (error) {
      if (error.message === "INVALID_REQUEST" || error.message === "INVALID_SHARED_ITEM") throw new ValidationError();
      if (error.message.includes("USER_NOT_ELIGIBLE")) {
        throw new AuthorizationError("This support request is currently available to eligible adult accounts.");
      }

      if (error.message.includes("ORGANIZATION_UNAVAILABLE")) {
        throw new NotFoundError("This organization is not accepting requests.");
      }

      logDatabaseError("createRequest", error);
      throw databaseError("Your support request could not be submitted.");
    }

    return { request: mapRequest(data as Row) };
  }

  async listOwnRequests(userId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("support_requests")
      .select(
        "id,organization_id,status,assigned_to,created_at,updated_at,sharing_expires_at,sharing_revoked_at,shared_journal_ids",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logDatabaseError("listOwnRequests", error);
      throw databaseError("Your support requests could not be loaded.");
    }

    return { requests: ((data ?? []) as Row[]).map(mapRequest) };
  }

  async updateOwnRequest(userId: string, requestId: string, input: { summary: string; preferredTime: string }) {
    const { data, error } = await this.database.schema("professional_service").rpc("update_own_request", {
      p_request_id: requestId, p_actor: userId,
      p_summary_encrypted: encryptText(input.summary, this.encryption),
      p_preferred_time_encrypted: encryptText(input.preferredTime, this.encryption),
    });
    if (error) this.ownerActionError(error);
    return { request: mapRequest(data as Row) };
  }

  async withdrawOwnRequest(userId: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("withdraw_own_request", {
      p_request_id: requestId, p_actor: userId,
    });
    if (error) this.ownerActionError(error);
    return { request: mapRequest(data as Row) };
  }

  private ownerActionError(error: { message: string }): never {
    if (error.message === "REQUEST_NOT_FOUND") throw new NotFoundError();
    if (error.message === "REQUEST_NOT_EDITABLE" || error.message === "SHARING_UNAVAILABLE") {
      throw new ConflictError("REQUEST_NOT_EDITABLE", "This request can no longer be changed. Refresh its current status.");
    }
    if (error.message === "REQUEST_INVALID") throw new ValidationError();
    throw databaseError("The request change could not be confirmed. Check its current status before retrying.");
  }

  async listQueue(userId: string, organizationId: string, input: ProfessionalQueueQuery = {}) {
    const parsed = professionalQueueQuery.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const filters = parsed.data;
    await this.membership(userId, organizationId);

    let query = this.database
      .schema("professional_service")
      .from("support_requests")
      .select("id,organization_id,status,assigned_to,created_at,updated_at", { count: "exact" })
      .eq("organization_id", organizationId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.assignedTo === "unassigned") query = query.is("assigned_to", null);
    else if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo === "me" ? userId : filters.assignedTo);
    if (filters.createdFrom) query = query.gte("created_at", `${filters.createdFrom}T00:00:00.000Z`);
    if (filters.createdThrough) {
      const after = new Date(`${filters.createdThrough}T00:00:00.000Z`);
      after.setUTCDate(after.getUTCDate() + 1);
      query = query.lt("created_at", after.toISOString());
    }
    const { data, error, count } = await query
      .order(filters.sort === "updated" ? "updated_at" : "created_at", { ascending: filters.sort === "oldest" })
      .order("id", { ascending: true })
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (error) {
      logDatabaseError("listQueue", error);
      throw databaseError("The request queue could not be loaded.");
    }
    if (typeof count !== "number") throw databaseError("The request count could not be confirmed.");

    const { error: auditError } = await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      action: "queue.viewed",
    });

    if (auditError) {
      logDatabaseError("listQueue.audit", auditError);
      throw databaseError("Queue access could not be recorded.");
    }

    // Membership may change while the query/audit is in flight. Never deliver
    // records on the strength of the earlier check alone.
    await this.membership(userId, organizationId);

    return {
      page: { offset: filters.offset, limit: filters.limit, total: count, hasMore: filters.offset + (data?.length ?? 0) < count },
      requests: ((data ?? []) as Row[]).map((row) => ({
        id: value(row, "id"),
        organizationId: value(row, "organization_id"),
        status: value(row, "status"),
        assignedTo: optional(row, "assigned_to"),
        createdAt: value(row, "created_at"),
        updatedAt: value(row, "updated_at"),
      })),
    };
  }

  private async requestRow(requestId: string): Promise<Row> {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("support_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error) {
      logDatabaseError("requestRow", error);
      throw databaseError("The support request could not be loaded.");
    }

    if (!data) throw new NotFoundError("The support request was not found.");

    return data as Row;
  }

  async dashboard(userId: string, organizationId: string) {
    await this.membership(userId, organizationId);
    const { data, error } = await this.database.schema("professional_service").rpc("dashboard_overview", {
      p_organization_id: organizationId, p_actor: userId,
    });
    if (error) this.caseMutationError(error, "The dashboard overview is temporarily unavailable.");
    await this.membership(userId, organizationId);
    return data;
  }

  private async assignedCase(userId: string, requestId: string): Promise<Row> {
    const row = await this.requestRow(requestId);

    await this.membership(userId, value(row, "organization_id"), true);

    if (row.assigned_to !== userId) {
      throw new AuthorizationError("Only the assigned professional may open this case.");
    }

    return row;
  }

  async detail(userId: string, requestId: string, viewer: "user" | "professional") {
    if (viewer === "professional") return this.professionalDetail(userId, requestId);
    const row = await this.requestRow(requestId);
    const owner = viewer === "user";

    if (owner && row.user_id !== userId) {
      throw new NotFoundError("The support request was not found.");
    }

    const mayReadShared = owner || sharingActive(row);

    const [sharedResult, appointmentResult, referralResult, noteResult] = await Promise.all([
      mayReadShared
        ? this.database
            .schema("professional_service")
            .from("shared_journals")
            .select("journal_id,title_encrypted,body_encrypted")
            .eq("request_id", requestId)
        : Promise.resolve({ data: [], error: null }),
      this.database
        .schema("professional_service")
        .from("appointments")
        .select("id,starts_at,ends_at,mode,location_hint_encrypted,status,professional_user_id")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
      this.database
        .schema("professional_service")
        .from("referrals")
        .select("id,resource_name,resource_url,created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
      owner
        ? Promise.resolve({ data: [], error: null })
        : this.database
            .schema("professional_service")
            .from("case_notes")
            .select("id,body_encrypted,created_at,author_user_id")
            .eq("request_id", requestId)
            .order("created_at", { ascending: false }),
    ]);

    if (sharedResult.error || appointmentResult.error || referralResult.error || noteResult.error) {
      if (sharedResult.error) logDatabaseError("detail.sharedJournals", sharedResult.error);
      if (appointmentResult.error) logDatabaseError("detail.appointments", appointmentResult.error);
      if (referralResult.error) logDatabaseError("detail.referrals", referralResult.error);
      if (noteResult.error) logDatabaseError("detail.notes", noteResult.error);

      throw databaseError("The case details could not be loaded.");
    }

    const { error: auditError } = await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: row.organization_id, request_id: requestId, actor_user_id: userId, action: "request.owner_viewed",
    });
    if (auditError) throw databaseError("Case access could not be recorded.");
    return this.projectCase(row, owner, mayReadShared, {
      sharedJournals: (sharedResult.data ?? []) as Row[], appointments: (appointmentResult.data ?? []) as Row[],
      referrals: (referralResult.data ?? []) as Row[], notes: (noteResult.data ?? []) as Row[],
    });
  }

  private async professionalDetail(userId: string, requestId: string) {
    // Retain early service checks; the RPC independently enforces current access
    // and commits the sensitive read audit in the same database transaction.
    const initial = await this.assignedCase(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").rpc("case_snapshot", {
      p_request_id: requestId, p_actor: userId,
    });
    if (error) this.caseMutationError(error, "The case details could not be loaded.");
    const snapshot = data as { request: Row; sharedJournals: Row[]; appointments: Row[]; referrals: Row[]; notes: Row[]; notesLifecycleAvailable?: boolean; closureReasonAvailable?: boolean; timeline?: { events: Array<{ id: string; action: string; at: string }>; hasMore: boolean; limit: number } } | null;
    if (!snapshot || snapshot.request?.id !== requestId || snapshot.request.organization_id !== initial.organization_id || snapshot.request.assigned_to !== userId) {
      throw databaseError("The case details could not be confirmed.");
    }
    // Revocation or permission loss may commit after the RPC returns. Recheck
    // before decrypting; already delivered data cannot be recalled.
    const current = await this.assignedCase(userId, requestId);
    const mayReadShared = sharingActive(snapshot.request) && sharingActive(current);
    return {
      ...this.projectCase({ ...snapshot.request, sharing_expires_at: current.sharing_expires_at, sharing_revoked_at: current.sharing_revoked_at }, false, mayReadShared, snapshot),
      timeline: snapshot.timeline,
      notesLifecycleAvailable: snapshot.notesLifecycleAvailable === true,
      closureReasonAvailable: snapshot.closureReasonAvailable === true,
    };
  }

  private projectCase(row: Row, owner: boolean, mayReadShared: boolean, children: { sharedJournals: Row[]; appointments: Row[]; referrals: Row[]; notes: Row[] }) {
    return {
      request: {
        ...mapRequest(row),
        preferredTime: mayReadShared ? decryptText(row.preferred_time_encrypted, this.encryption) : "",
        summary: mayReadShared ? decryptText(row.summary_encrypted, this.encryption) : null,
      },
      sharedJournals: (mayReadShared ? children.sharedJournals : []).map((item) => ({
        journalId: value(item, "journal_id"),
        title: decryptText(item.title_encrypted, this.encryption),
        body: decryptText(item.body_encrypted, this.encryption),
      })),
      appointments: children.appointments.map((item) => ({
        id: value(item, "id"),
        startsAt: value(item, "starts_at"),
        endsAt: value(item, "ends_at"),
        mode: value(item, "mode"),
        locationHint: decryptText(item.location_hint_encrypted, this.encryption),
        status: value(item, "status"),
      })),
      referrals: children.referrals.map((item) => ({
        id: value(item, "id"),
        resourceName: value(item, "resource_name"),
        resourceUrl: optional(item, "resource_url"),
        createdAt: value(item, "created_at"),
      })),
      notes: children.notes.map((item) => ({
        id: value(item, "id"),
        body: decryptText(item.body_encrypted, this.encryption),
        createdAt: value(item, "created_at"),
        state: value(item, "state") || "final", revision: typeof item.revision === "number" ? item.revision : 1,
        updatedAt: value(item, "updated_at") || value(item, "created_at"), finalizedAt: optional(item, "finalized_at"),
      })),
      viewer: owner ? "user" : "professional",
    };
  }

  async claim(userId: string, requestId: string) {
    const row = await this.requestRow(requestId);
    await this.membership(userId, value(row, "organization_id"), true);

    const { data, error } = await this.database.schema("professional_service").rpc("claim_request", {
      p_request_id: requestId,
      p_actor: userId,
    });

    if (error) {
      this.caseMutationError(error, "The request acceptance could not be confirmed. Refresh the queue before retrying.");
    }

    return { request: mapRequest(data as Row) };
  }

  async revoke(userId: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("revoke_sharing", {
      p_request_id: requestId,
      p_actor: userId,
    });

    if (error) {
      if (error.message.includes("REQUEST_NOT_FOUND")) throw new NotFoundError();

      logDatabaseError("revoke", error);
      throw databaseError("Sharing could not be stopped.");
    }

    return { request: mapRequest(data as Row) };
  }

  async close(userId: string, requestId: string, reason?: string) {
    await this.assignedCase(userId, requestId);

    const { data, error } = await this.database.schema("professional_service").rpc("close_case", {
      p_request_id: requestId,
      p_actor: userId,
      p_reason_encrypted: reason ? encryptText(reason, this.encryption) : null,
    });

    if (error) {
      this.caseMutationError(error, "The case closure could not be confirmed. Refresh its status before retrying.");
    }

    if (reason && (!data?.reasonEncrypted || decryptText(data.reasonEncrypted, this.encryption) !== reason)) throw new ConflictError("CLOSURE_CONFLICT", "This case already has a different closure record. Refresh its status.");
    return { request: mapRequest(data.request as Row) };
  }

  async transfer(userId: string, requestId: string, input: { targetUserId: string; reason: string; submissionId: string }) {
    const row = await this.requestRow(requestId);
    await this.membership(userId, value(row, "organization_id"), true);
    const { data, error } = await this.database.schema("professional_service").rpc("transfer_case", {
      p_request_id: requestId, p_actor: userId, p_target: input.targetUserId,
      p_reason_encrypted: encryptText(input.reason, this.encryption), p_submission_id: input.submissionId,
    });
    if (error) this.caseMutationError(error, "The case transfer could not be confirmed. Refresh assignment before retrying.");
    if (!data?.reasonEncrypted || decryptText(data.reasonEncrypted, this.encryption) !== input.reason) throw new ConflictError("TRANSFER_CONFLICT", "This transfer identifier already belongs to another handover. Refresh assignment.");
    return { request: mapRequest(data.request as Row), transferId: data.transferId as string };
  }

  private caseMutationError(error: { message: string }, fallback: string): never {
    switch (error.message) {
      case "REQUEST_NOT_FOUND": throw new NotFoundError();
      case "MEMBERSHIP_REQUIRED":
      case "ASSIGNMENT_REQUIRED": throw new AuthorizationError();
      case "REQUEST_ALREADY_ASSIGNED": throw new ConflictError("REQUEST_ALREADY_ASSIGNED", "This request is no longer available to accept. Refresh the queue.");
      case "APPOINTMENT_ACTIVE": throw new ConflictError("APPOINTMENT_ACTIVE", "Cancel the active appointment before closing this case.");
      case "INVALID_CASE_TRANSITION": throw new ConflictError("CASE_CLOSED", "This case cannot be changed in its current state. Refresh its status.");
      case "INVALID_STATUS": throw new ValidationError();
      case "INVALID_NOTE": throw new ValidationError();
      case "INVALID_TRANSFER":
      case "INVALID_CLOSURE": throw new ValidationError();
      case "TRANSFER_TARGET_UNAVAILABLE": throw new ConflictError("TRANSFER_TARGET_UNAVAILABLE", "The selected practitioner is not available for this handover.");
      case "TRANSFER_CONFLICT":
      case "CLOSURE_CONFLICT": throw new ConflictError(error.message, "This case action has already changed. Refresh its current status.");
      case "DRAFT_NOTES_PENDING": throw new ConflictError("DRAFT_NOTES_PENDING", "Finalize your draft notes before transferring the case.");
      case "NOTE_IMMUTABLE": throw new ConflictError("NOTE_IMMUTABLE", "Final notes cannot be edited.");
      case "NOTE_REVISION_CONFLICT": throw new ConflictError("NOTE_REVISION_CONFLICT", "This draft changed. Reload it before editing again.");
      default: throw databaseError(fallback);
    }
  }

  async proposeAppointment(
    userId: string,
    requestId: string,
    input: {
      startsAt: string;
      endsAt: string;
      mode: "in_person" | "online" | "phone";
      locationHint: string;
    },
  ) {
    await this.assignedCase(userId, requestId);

    const { data, error } = await this.database.schema("professional_service").rpc("propose_appointment", {
      p_request_id: requestId,
      p_actor: userId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_mode: input.mode,
      p_location_hint_encrypted: encryptText(input.locationHint, this.encryption),
    });

    if (error) {
      this.appointmentError(error, "The appointment proposal could not be confirmed. Refresh the case before retrying.");
    }

    return { appointmentId: value(data as Row, "id") };
  }

  async respondAppointment(userId: string, appointmentId: string, accept: boolean) {
    const { data, error } = await this.database.schema("professional_service").rpc("respond_appointment", {
      p_appointment_id: appointmentId,
      p_actor: userId,
      p_accept: accept,
    });

    if (error) {
      this.appointmentError(error, "The appointment response could not be confirmed. Refresh its status before retrying.");
    }

    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  async cancelAppointment(
    userId: string,
    appointmentId: string,
    assuranceLevel: AuthenticatedUser["assuranceLevel"],
  ) {
    // This endpoint serves owners and practitioners. Resolve the owner from the
    // database; a body/query flag must never exempt a practitioner from MFA.
    const { data: appointment, error: appointmentError } = await this.database
      .schema("professional_service")
      .from("appointments")
      .select("request_id")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appointmentError) {
      logDatabaseError("cancelAppointment.appointment", appointmentError);
      throw databaseError("Appointment access could not be checked.");
    }
    if (!appointment) {
      throw new ConflictError("APPOINTMENT_UNAVAILABLE", "This appointment can no longer be canceled.");
    }

    const { data: request, error: requestError } = await this.database
      .schema("professional_service")
      .from("support_requests")
      .select("user_id,organization_id,assigned_to")
      .eq("id", appointment.request_id)
      .maybeSingle();

    if (requestError) {
      logDatabaseError("cancelAppointment.request", requestError);
      throw databaseError("Appointment access could not be checked.");
    }
    if (!request) throw new NotFoundError();

    if (request.user_id !== userId) {
      if (request.assigned_to !== userId) throw new NotFoundError();
      await this.membership(userId, value(request, "organization_id"), true);
      if (assuranceLevel !== "aal2") {
        throw new AppError({
          statusCode: 403,
          code: "MFA_REQUIRED",
          message: "Multi-factor authentication is required.",
        });
      }
    }

    // The RPC still rechecks ownership, membership and state transactionally.
    const { data, error } = await this.database.schema("professional_service").rpc("cancel_appointment", {
      p_appointment_id: appointmentId,
      p_actor: userId,
    });

    if (error) {
      this.appointmentError(error, "The appointment cancellation could not be confirmed. Refresh its status before retrying.");
    }

    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  private appointmentError(error: { message: string; code?: string }, fallback: string): never {
    if (error.code === "23505" || error.code === "23P01" || error.message === "APPOINTMENT_CONFLICT") {
      throw new ConflictError("APPOINTMENT_CONFLICT", "This time is already booked or an offer is pending.");
    }
    if (error.message === "INVALID_APPOINTMENT") throw new ValidationError({ appointment: ["Choose a future start and an end within two hours, with a supported session type."] });
    if (error.message === "APPOINTMENT_UNAVAILABLE" || error.message === "APPOINTMENT_EXPIRED") {
      throw new ConflictError(error.message, "This appointment offer is no longer available. Refresh the case.");
    }
    this.caseMutationError(error, fallback);
  }

  async rescheduleAppointment(userId: string, appointmentId: string, input: { startsAt: string; endsAt: string; mode: "in_person" | "online" | "phone"; locationHint: string }) {
    const { data, error } = await this.database.schema("professional_service").rpc("reschedule_appointment", {
      p_appointment_id: appointmentId, p_actor: userId, p_starts_at: input.startsAt, p_ends_at: input.endsAt,
      p_mode: input.mode, p_location_hint_encrypted: encryptText(input.locationHint, this.encryption),
    });
    if (error) this.appointmentError(error, "Rescheduling could not be confirmed. Refresh the case before retrying.");
    if (!data || decryptText(data.location_hint_encrypted, this.encryption) !== input.locationHint) {
      throw new ConflictError("APPOINTMENT_CONFLICT", "This appointment already has a different replacement. Refresh the case.");
    }
    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  async addNote(userId: string, requestId: string, body: string, options: { submissionId?: string; state?: "draft" | "final" } = {}) {
    await this.assignedCase(userId, requestId);
    if (body.trim().length < 2 || body.trim().length > 4000) throw new ValidationError();
    const state = options.state ?? "final";
    const { data, error } = await this.database.schema("professional_service").rpc("save_case_note", {
      p_request_id: requestId, p_actor: userId, p_body_encrypted: encryptText(body.trim(), this.encryption),
      p_submission_id: options.submissionId ?? randomUUID(), p_state: state,
    });
    if (error) this.caseMutationError(error, "The case note could not be saved. Check the case before retrying.");
    // Compare authenticated ciphertext on a replay, rather than persisting a
    // guessable plaintext note hash. The RPC inserts at most once per key.
    if (!data || decryptText(data.body_encrypted, this.encryption) !== body.trim() || data.state !== state) {
      throw new ConflictError("NOTE_SUBMISSION_CONFLICT", "This submission identifier already belongs to a different note. Reload the case.");
    }
    return { noteId: value(data as Row, "id"), state: value(data as Row, "state"), revision: data.revision as number };
  }

  async editNote(userId: string, requestId: string, noteId: string, input: { body: string; expectedRevision: number; finalize: boolean }) {
    await this.assignedCase(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").rpc("edit_case_note", {
      p_request_id: requestId, p_note_id: noteId, p_actor: userId,
      p_body_encrypted: encryptText(input.body, this.encryption), p_expected_revision: input.expectedRevision, p_finalize: input.finalize,
    });
    if (error) this.caseMutationError(error, "The note change could not be confirmed. Reload the case before retrying.");
    if (!data || decryptText(data.body_encrypted, this.encryption) !== input.body) throw new ConflictError("NOTE_SUBMISSION_CONFLICT", "The note already contains a different finalized revision. Reload the case.");
    return { noteId: value(data as Row, "id"), state: value(data as Row, "state"), revision: data.revision as number };
  }

  async addReferral(userId: string, requestId: string, resourceName: string, resourceUrl: string | null, submissionId?: string) {
    await this.assignedCase(userId, requestId);
    return this.referrals.create(userId, requestId, resourceName, resourceUrl, submissionId);
  }

  async createOrganization(
    adminId: string,
    input: { slug: string; name: string; description: string; serviceHours: string },
  ) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("organizations")
      .insert({
        slug: input.slug,
        name: input.name,
        description: input.description,
        service_hours: input.serviceHours,
        created_by: adminId,
      })
      .select("id,slug,name,description,service_hours,status")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictError("ORGANIZATION_EXISTS", "This organization slug is already used.");
      }

      logDatabaseError("createOrganization", error);
      throw databaseError("The organization could not be created.");
    }

    return { organization: mapOrganization(data as Row) };
  }

  async listOrganizationsForAdmin() {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("id,slug,name,description,service_hours,status")
      .order("created_at", { ascending: false });

    if (error) {
      logDatabaseError("listOrganizationsForAdmin", error);
      throw databaseError("Professional organizations could not be loaded.");
    }

    return { organizations: ((data ?? []) as Row[]).map(mapOrganization) };
  }

  async listMembersForAdmin(organizationId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,user_id,role,status,display_name,credential_label,credential_expires_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      logDatabaseError("listMembersForAdmin", error);
      throw databaseError("Organization members could not be loaded.");
    }

    return {
      memberships: ((data ?? []) as Row[]).map((row) => ({
        id: value(row, "id"),
        userId: value(row, "user_id"),
        role: value(row, "role"),
        status: value(row, "status"),
        displayName: value(row, "display_name"),
        credentialLabel: optional(row, "credential_label"),
        credentialExpiresAt: optional(row, "credential_expires_at"),
      })),
    };
  }

  async listAuditForAdmin(organizationId: string, adminId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("audit_events")
      .select("id,request_id,action,actor_user_id,subject_user_id,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logDatabaseError("listAuditForAdmin", error);
      throw databaseError("Recent professional activity could not be loaded.");
    }

    const { error: auditError } = await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: organizationId, actor_user_id: adminId, action: "admin.audit_viewed",
    });
    if (auditError) throw databaseError("Audit access could not be recorded.");

    return {
      events: ((data ?? []) as Row[]).map((row) => ({
        id: value(row, "id"),
        action: value(row, "action"),
        requestId: optional(row, "request_id"),
        actorUserId: value(row, "actor_user_id"),
        subjectUserId: optional(row, "subject_user_id"),
        createdAt: value(row, "created_at"),
      })),
    };
  }

  async approveOrganization(adminId: string, organizationId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("organizations")
      .update({
        status: "active",
        verified_at: new Date().toISOString(),
        verified_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId)
      .in("status", ["pending", "suspended"])
      .select("id,slug,name,description,service_hours,status")
      .maybeSingle();

    if (error) {
      logDatabaseError("approveOrganization", error);
      throw databaseError("The organization could not be approved.");
    }

    if (!data) {
      throw new ConflictError("ORGANIZATION_UNAVAILABLE", "This organization cannot be approved.");
    }

    return { organization: mapOrganization(data as Row) };
  }

  async suspendOrganization(adminId: string, organizationId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("suspend_organization", {
      p_organization_id: organizationId,
      p_actor: adminId,
    });

    if (error) {
      if (error.message.includes("ORGANIZATION_UNAVAILABLE")) {
        throw new ConflictError("ORGANIZATION_UNAVAILABLE", "This organization is not active.");
      }

      logDatabaseError("suspendOrganization", error);
      throw databaseError("The organization could not be suspended.");
    }

    return { organization: mapOrganization(data as Row) };
  }

  async approveMember(
    adminId: string,
    input: {
      organizationId: string;
      userId: string;
      role: ProfessionalRole;
      displayName: string;
      credentialLabel: string | null;
      credentialExpiresAt: string | null;
      credentialId?: string;
    },
  ) {
    if (adminId === input.userId) {
      throw new AuthorizationError("Another administrator must approve your professional membership.");
    }

    const { data: organization, error: orgError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("status")
      .eq("id", input.organizationId)
      .maybeSingle();

    if (orgError) {
      logDatabaseError("approveMember.organization", orgError);
      throw databaseError("Organization access could not be checked.");
    }

    if (organization?.status !== "active") {
      throw new AuthorizationError("Approve the organization before adding staff.");
    }

    const { data: profile, error: profileError } = await this.database
      .schema("user_service")
      .from("profiles")
      .select("account_status,eligible_18_plus,onboarding_completed")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (profileError) {
      logDatabaseError("approveMember.profile", profileError);
      throw databaseError("The staff account could not be checked.");
    }

    if (
      profile?.account_status !== "active" ||
      profile.eligible_18_plus !== true ||
      profile.onboarding_completed !== true
    ) {
      throw new AuthorizationError("The staff member needs an active eligible ECHO account before approval.");
    }

    if (
      CLINICAL_ROLES.has(input.role) &&
      (!input.credentialLabel ||
        !input.credentialExpiresAt ||
        input.credentialExpiresAt < new Date().toISOString().slice(0, 10))
    ) {
      throw new AuthorizationError("A reviewed, unexpired practitioner credential is required.");
    }

    if (CLINICAL_ROLES.has(input.role)) await this.credentials.requireApproved(input);

    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: input.userId,
          role: input.role,
          display_name: input.displayName,
          status: "active",
          credential_label: input.credentialLabel,
          credential_expires_at: input.credentialExpiresAt,
          approved_credential_id: CLINICAL_ROLES.has(input.role) ? input.credentialId : null,
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      )
      .select("id")
      .single();

    if (error) {
      logDatabaseError("approveMember", error);
      throw databaseError("Professional access could not be approved.");
    }

    return { membershipId: data.id as string };
  }

  async suspendMember(adminId: string, membershipId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("suspend_member", {
      p_membership_id: membershipId,
      p_actor: adminId,
    });

    if (error) {
      if (error.message.includes("MEMBERSHIP_UNAVAILABLE")) {
        throw new ConflictError("MEMBERSHIP_UNAVAILABLE", "This professional access is not active.");
      }

      logDatabaseError("suspendMember", error);
      throw databaseError("Professional access could not be suspended.");
    }

    return { membershipId: value(data as Row, "id"), status: "suspended" };
  }
}
