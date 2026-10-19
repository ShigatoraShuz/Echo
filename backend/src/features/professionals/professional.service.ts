import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decryptText,
  encryptText,
  type EncryptionService,
} from "../../infrastructure/encryption/encryption.service.js";
import {
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  NotFoundError,
} from "../../shared/errors/app-error.js";
import type { JournalService } from "../journals/journals.service.js";

type Row = Record<string, unknown>;
type ProfessionalRole = "counselor" | "psychologist" | "social_worker" | "coordinator" | "org_admin";
const CLINICAL_ROLES = new Set<ProfessionalRole>(["counselor", "psychologist", "social_worker"]);
export const PROFESSIONAL_CONSENT_VERSION = "professional-request-v2";

function value(row: Row, key: string): string {
  return typeof row[key] === "string" ? (row[key] as string) : "";
}
function optional(row: Row, key: string): string | null {
  return typeof row[key] === "string" ? (row[key] as string) : null;
}
function strings(row: Row, key: string): string[] {
  return Array.isArray(row[key]) ? (row[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];
}
function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
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
    location: value(row, "location_label"),
    serviceTypes: strings(row, "service_types"),
    consultationMethods: strings(row, "consultation_methods"),
    status: value(row, "status"),
  };
}
function mapRequest(row: Row) {
  return {
    id: value(row, "id"),
    organizationId: value(row, "organization_id"),
    preferredProfileId: optional(row, "preferred_profile_id"),
    status: value(row, "status"),
    assignedTo: optional(row, "assigned_to"),
    createdAt: value(row, "created_at"),
    updatedAt: value(row, "updated_at"),
    preferredTime: "",
    sharingActive: sharingActive(row),
    sharedJournalCount: Array.isArray(row.shared_journal_ids) ? row.shared_journal_ids.length : 0,
    sharedPhq8Count: typeof row.shared_phq8_count === "number" ? row.shared_phq8_count : 0,
  };
}

export class ProfessionalService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly journals: JournalService,
  ) {}

  private async notify(userId: string | null, type: string, title: string, message: string, requestId: string) {
    if (!userId) return;
    await this.database.schema("notification_service").from("notifications").insert({
      user_id: userId,
      notification_type: type,
      title,
      message,
      resource_type: "professional_case",
      resource_id: requestId,
    });
  }

  private async event(requestId: string, actorUserId: string, eventType: string, label: string) {
    await this.database.schema("professional_service").from("case_events").insert({
      request_id: requestId, actor_user_id: actorUserId, event_type: eventType, label,
    });
  }

  async listOrganizations() {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("id,slug,name,description,service_hours,location_label,service_types,consultation_methods,status")
      .eq("status", "active")
      .eq("accepting_requests", true)
      .order("name");
    if (error) throw databaseError("Professional organizations could not be loaded.");
    return { organizations: ((data ?? []) as Row[]).map(mapOrganization) };
  }

  async memberships(userId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,organization_id,role,status,display_name,credential_label,credential_expires_at")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw databaseError("Professional access could not be checked.");
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
    if (organizationError) throw databaseError("Organizations could not be loaded.");
    const byId = new Map(((organizations ?? []) as Row[]).map((item) => [value(item, "id"), mapOrganization(item)]));
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
                : value(item, "status") !== "active"
                  ? "pending_membership"
                  : CLINICAL_ROLES.has(value(item, "role") as ProfessionalRole) &&
                      (!value(item, "credential_expires_at") ||
                        value(item, "credential_expires_at") < new Date().toISOString().slice(0, 10))
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
    if (error) throw databaseError("Professional access could not be checked.");
    const member = data as Row | null;
    if (!member || member.status !== "active")
      throw new AuthorizationError("You do not have active access to this organization.");
    const { data: organization, error: organizationError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("status")
      .eq("id", organizationId)
      .maybeSingle();
    if (organizationError) throw databaseError("Organization access could not be checked.");
    if (organization?.status !== "active")
      throw new AuthorizationError("This organization is not accepting professional access.");
    if (
      CLINICAL_ROLES.has(value(member, "role") as ProfessionalRole) &&
      value(member, "credential_expires_at") < new Date().toISOString().slice(0, 10)
    )
      throw new AuthorizationError("Your professional credential has expired.");
    if (clinical) {
      const role = value(member, "role") as ProfessionalRole;
      const expires = value(member, "credential_expires_at");
      if (!CLINICAL_ROLES.has(role) || !expires || expires < new Date().toISOString().slice(0, 10))
        throw new AuthorizationError("An active reviewed practitioner credential is required.");
    }
    return member;
  }

  async createRequest(
    userId: string,
    input: {
      submissionId: string;
      organizationId: string;
      preferredProfileId: string | null;
      summary: string;
      preferredTime: string;
      journalIds: string[];
      phq8Ids: string[];
    },
  ) {
    const journalIds = [...new Set(input.journalIds)];
    const phq8Ids = [...new Set(input.phq8Ids)];
    if (journalIds.length !== input.journalIds.length)
      throw new ConflictError("DUPLICATE_JOURNAL", "Choose each journal only once.");
    if (phq8Ids.length !== input.phq8Ids.length)
      throw new ConflictError("DUPLICATE_PHQ8", "Choose each check-in only once.");
    const journalSnapshots = await Promise.all(
      journalIds.map(async (journalId) => {
        const journal = await this.journals.get(userId, journalId);
        return {
          resourceType: "journal",
          sourceRecordId: journalId,
          labelEncrypted: encryptText(journal.title || "Untitled reflection", this.encryption),
          payloadEncrypted: encryptText(journal.body, this.encryption),
        };
      }),
    );
    const phq8Snapshots = phq8Ids.length === 0 ? [] : await this.phq8Snapshots(userId, phq8Ids);
    const { data, error } = await this.database.schema("professional_service").rpc("create_request_v2", {
      p_submission_id: input.submissionId,
      p_organization_id: input.organizationId,
      p_user_id: userId,
      p_preferred_profile_id: input.preferredProfileId,
      p_summary_encrypted: encryptText(input.summary, this.encryption),
      p_preferred_time_encrypted: encryptText(input.preferredTime, this.encryption),
      p_consent_version: PROFESSIONAL_CONSENT_VERSION,
      p_shared_items: [...journalSnapshots, ...phq8Snapshots],
    });
    if (error) {
      if (error.message.includes("USER_NOT_ELIGIBLE"))
        throw new AuthorizationError("This support request is currently available to eligible adult accounts.");
      if (error.message.includes("ORGANIZATION_UNAVAILABLE"))
        throw new NotFoundError("This organization is not accepting requests.");
      if (error.message.includes("PRACTITIONER_UNAVAILABLE"))
        throw new ConflictError("PRACTITIONER_UNAVAILABLE", "That practitioner is no longer accepting requests.");
      throw databaseError("Your support request could not be submitted.");
    }
    return { request: mapRequest(data as Row) };
  }

  private async phq8Snapshots(userId: string, ids: string[]) {
    const { data, error } = await this.database
      .schema("insights_service")
      .from("phq8_assessments")
      .select("id,submission_id,assessment_ciphertext,completed_at")
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw databaseError("Your selected check-ins could not be loaded.");
    const rows = (data ?? []) as Row[];
    if (rows.length !== ids.length) throw new NotFoundError("One of the selected check-ins was not found.");
    return rows.map((row) => {
      try {
        const opened = JSON.parse(decryptText(row.assessment_ciphertext, this.encryption)) as Row;
        const score = typeof opened.score === "number" ? opened.score : null;
        const severity = value(opened, "severity");
        if (opened.userId !== userId || score === null || !severity) throw new Error("Invalid assessment");
        const completedAt = value(row, "completed_at");
        return {
          resourceType: "phq8",
          sourceRecordId: value(row, "id"),
          labelEncrypted: encryptText(`PHQ-8 check-in · ${completedAt.slice(0, 10)}`, this.encryption),
          payloadEncrypted: encryptText(JSON.stringify({ score, severity, completedAt, context: "Non-diagnostic self-report" }), this.encryption),
        };
      } catch {
        throw databaseError("Your selected check-ins could not be opened.");
      }
    });
  }

  async listOwnRequests(userId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("support_requests")
      .select(
        "id,organization_id,preferred_profile_id,status,assigned_to,created_at,updated_at,sharing_expires_at,sharing_revoked_at,shared_journal_ids",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw databaseError("Your support requests could not be loaded.");
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return { requests: [] };
    const { data: shared, error: sharedError } = await this.database
      .schema("professional_service")
      .from("case_shared_records")
      .select("request_id,resource_type,revoked_at,expires_at")
      .in("request_id", rows.map((item) => value(item, "id")));
    if (sharedError) throw databaseError("Your support requests could not be loaded.");
    const counts = new Map<string, { journal: number; phq8: number }>();
    for (const item of (shared ?? []) as Row[]) {
      if (item.revoked_at || value(item, "expires_at") <= new Date().toISOString()) continue;
      const count = counts.get(value(item, "request_id")) ?? { journal: 0, phq8: 0 };
      const type = value(item, "resource_type") as "journal" | "phq8";
      count[type] += 1;
      counts.set(value(item, "request_id"), count);
    }
    return { requests: rows.map((row) => ({
      ...mapRequest(row),
      sharedJournalCount: counts.get(value(row, "id"))?.journal ?? 0,
      sharedPhq8Count: counts.get(value(row, "id"))?.phq8 ?? 0,
    })) };
  }

  async listQueue(userId: string, organizationId: string) {
    await this.membership(userId, organizationId);
    const { data, error } = await this.database
      .schema("professional_service")
      .from("support_requests")
      .select("id,organization_id,status,assigned_to,created_at,updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw databaseError("The request queue could not be loaded.");
    const { error: auditError } = await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      action: "queue.viewed",
    });
    if (auditError) throw databaseError("Queue access could not be recorded.");
    return {
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
    if (error) throw databaseError("The support request could not be loaded.");
    if (!data) throw new NotFoundError("The support request was not found.");
    return data as Row;
  }

  private async assignedCase(userId: string, requestId: string): Promise<Row> {
    const row = await this.requestRow(requestId);
    await this.membership(userId, value(row, "organization_id"), true);
    if (row.assigned_to !== userId) throw new AuthorizationError("Only the assigned professional may open this case.");
    return row;
  }

  async detail(userId: string, requestId: string, viewer: "user" | "professional") {
    let row = await this.requestRow(requestId);
    const owner = viewer === "user";
    if (owner && row.user_id !== userId) throw new NotFoundError("The support request was not found.");
    if (!owner) row = await this.assignedCase(userId, requestId);
    const mayReadShared = owner || sharingActive(row);
    const [sharedResult, appointmentResult, referralResult, noteResult] = await Promise.all([
      mayReadShared
        ? this.database
            .schema("professional_service")
            .from("case_shared_records")
            .select("id,resource_type,source_record_id,label_encrypted,payload_encrypted,expires_at,revoked_at")
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
    if (sharedResult.error || appointmentResult.error || referralResult.error || noteResult.error)
      throw databaseError("The case details could not be loaded.");
    const appointmentIds = ((appointmentResult.data ?? []) as Row[]).map((item) => value(item, "id"));
    const changeResult = appointmentIds.length === 0
      ? { data: [] as Row[], error: null }
      : await this.database.schema("professional_service").from("appointment_change_requests")
          .select("id,appointment_id,preferred_time_encrypted,status,created_at")
          .in("appointment_id", appointmentIds).order("created_at", { ascending: false });
    if (changeResult.error) throw databaseError("Appointment change requests could not be loaded.");
    if (!owner) {
      const { error } = await this.database.schema("professional_service").from("audit_events").insert({
        organization_id: row.organization_id,
        request_id: requestId,
        actor_user_id: userId,
        action: "case.opened",
      });
      if (error) throw databaseError("Case access could not be recorded.");
    }
    return {
      request: {
        ...mapRequest(row),
        preferredTime: mayReadShared ? decryptText(row.preferred_time_encrypted, this.encryption) : "",
        summary: mayReadShared ? decryptText(row.summary_encrypted, this.encryption) : null,
      },
      sharedJournals: ((sharedResult.data ?? []) as Row[])
        .filter((item) => value(item, "resource_type") === "journal" && (owner || (!item.revoked_at && value(item, "expires_at") > new Date().toISOString())))
        .map((item) => ({
          journalId: value(item, "source_record_id"),
          title: decryptText(item.label_encrypted, this.encryption),
          body: decryptText(item.payload_encrypted, this.encryption),
        })),
      sharedPhq8: ((sharedResult.data ?? []) as Row[])
        .filter((item) => value(item, "resource_type") === "phq8" && (owner || (!item.revoked_at && value(item, "expires_at") > new Date().toISOString())))
        .map((item) => ({
          id: value(item, "source_record_id"),
          label: decryptText(item.label_encrypted, this.encryption),
          ...JSON.parse(decryptText(item.payload_encrypted, this.encryption)) as Row,
        })),
      appointments: ((appointmentResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"),
        startsAt: value(item, "starts_at"),
        endsAt: value(item, "ends_at"),
        mode: value(item, "mode"),
        locationHint: decryptText(item.location_hint_encrypted, this.encryption),
        status: value(item, "status"),
      })),
      appointmentChangeRequests: ((changeResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"), appointmentId: value(item, "appointment_id"),
        preferredTime: decryptText(item.preferred_time_encrypted, this.encryption),
        status: value(item, "status"), createdAt: value(item, "created_at"),
      })),
      referrals: ((referralResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"),
        resourceName: value(item, "resource_name"),
        resourceUrl: optional(item, "resource_url"),
        createdAt: value(item, "created_at"),
      })),
      notes: ((noteResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"),
        body: decryptText(item.body_encrypted, this.encryption),
        createdAt: value(item, "created_at"),
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
      if (error.message.includes("REQUEST_ALREADY_ASSIGNED"))
        throw new ConflictError("REQUEST_ALREADY_ASSIGNED", "Another professional has already accepted this request.");
      throw databaseError("The request could not be accepted.");
    }
    await this.notify(optional(data as Row, "user_id"), "professional_case_assigned", "Professional support updated", "A practitioner has been assigned to your support request.", requestId);
    await this.event(requestId, userId, "practitioner_assigned", "Practitioner assigned");
    return { request: mapRequest(data as Row) };
  }

  async assign(userId: string, requestId: string, profileId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("assign_request", {
      p_request_id: requestId, p_actor: userId, p_profile_id: profileId,
    });
    if (error) {
      if (error.message.includes("CASE_NOT_ACTIVE")) throw new ConflictError("CASE_NOT_ACTIVE", "This case can no longer be assigned.");
      if (error.message.includes("PRACTITIONER_UNAVAILABLE")) throw new ConflictError("PRACTITIONER_UNAVAILABLE", "That practitioner is unavailable.");
      if (error.message.includes("ASSIGNMENT_REQUIRED")) throw new AuthorizationError("Coordinator access is required.");
      throw databaseError("The case could not be assigned.");
    }
    await this.notify(optional(data as Row, "user_id"), "professional_case_assigned", "Professional support updated", "A practitioner has been assigned to your support request.", requestId);
    return { request: mapRequest(data as Row) };
  }

  async revoke(userId: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("revoke_sharing", {
      p_request_id: requestId,
      p_actor: userId,
    });
    if (error) {
      if (error.message.includes("REQUEST_NOT_FOUND")) throw new NotFoundError();
      throw databaseError("Sharing could not be stopped.");
    }
    return { request: mapRequest(data as Row) };
  }

  async close(userId: string, requestId: string) {
    const request = await this.assignedCase(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").rpc("set_request_status", {
      p_request_id: requestId,
      p_actor: userId,
      p_status: "closed",
    });
    if (error) {
      if (error.message.includes("APPOINTMENT_ACTIVE"))
        throw new ConflictError("APPOINTMENT_ACTIVE", "Cancel the active appointment before closing this case.");
      throw databaseError("The case could not be closed.");
    }
    await this.event(requestId, userId, "case_closed", "Case closed");
    await this.notify(optional(request, "user_id"), "professional_case_closed", "Professional support updated", "Your professional support case was closed.", requestId);
    return { request: mapRequest(data as Row) };
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
    const request = await this.assignedCase(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").rpc("propose_appointment", {
      p_request_id: requestId,
      p_actor: userId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_mode: input.mode,
      p_location_hint_encrypted: encryptText(input.locationHint, this.encryption),
    });
    if (error) {
      if (error.message.includes("APPOINTMENT_CONFLICT") || error.code === "23505")
        throw new ConflictError("APPOINTMENT_CONFLICT", "This time is already booked or an offer is pending.");
      throw databaseError("The appointment could not be proposed.");
    }
    await this.notify(optional(request, "user_id"), "professional_appointment_proposed", "Appointment response needed", "A new appointment time is ready for your review.", requestId);
    await this.event(requestId, userId, "appointment_proposed", "Appointment proposed");
    return { appointmentId: value(data as Row, "id") };
  }

  async respondAppointment(userId: string, appointmentId: string, accept: boolean) {
    const { data, error } = await this.database.schema("professional_service").rpc("respond_appointment", {
      p_appointment_id: appointmentId,
      p_actor: userId,
      p_accept: accept,
    });
    if (error) {
      if (error.message.includes("REQUEST_NOT_FOUND")) throw new NotFoundError();
      if (error.message.includes("APPOINTMENT_UNAVAILABLE"))
        throw new ConflictError("APPOINTMENT_UNAVAILABLE", "This offer is no longer available.");
      throw databaseError("The appointment response could not be saved.");
    }
    await this.event(value(data as Row, "request_id"), userId, accept ? "appointment_confirmed" : "appointment_declined", accept ? "Appointment confirmed" : "Appointment declined");
    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  async cancelAppointment(userId: string, appointmentId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("cancel_appointment", {
      p_appointment_id: appointmentId,
      p_actor: userId,
    });
    if (error) {
      if (error.message.includes("APPOINTMENT_UNAVAILABLE"))
        throw new ConflictError("APPOINTMENT_UNAVAILABLE", "This appointment can no longer be canceled.");
      if (error.message.includes("REQUEST_NOT_FOUND")) throw new NotFoundError();
      throw databaseError("The appointment could not be canceled.");
    }
    await this.event(value(data as Row, "request_id"), userId, "appointment_canceled", "Appointment canceled");
    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  async completeAppointment(userId: string, appointmentId: string) {
    const { data: appointment, error: appointmentError } = await this.database.schema("professional_service")
      .from("appointments")
      .select("request_id,starts_at")
      .eq("id", appointmentId)
      .maybeSingle();
    if (appointmentError) throw databaseError("The appointment could not be loaded.");
    if (!appointment) throw new NotFoundError();
    await this.assignedCase(userId, value(appointment as Row, "request_id"));
    if (new Date(value(appointment as Row, "starts_at")).getTime() > Date.now())
      throw new ConflictError("APPOINTMENT_NOT_STARTED", "This appointment cannot be completed before its scheduled start.");
    const { data, error } = await this.database.schema("professional_service").rpc("complete_appointment", {
      p_appointment_id: appointmentId,
      p_actor: userId,
    });
    if (error) {
      if (error.message.includes("APPOINTMENT_UNAVAILABLE"))
        throw new ConflictError("APPOINTMENT_UNAVAILABLE", "This appointment cannot be completed.");
      if (error.message.includes("ASSIGNMENT_REQUIRED")) throw new NotFoundError();
      throw databaseError("The appointment could not be completed.");
    }
    const requestId = value(data as Row, "request_id");
    const request = await this.requestRow(requestId);
    await this.event(requestId, userId, "appointment_completed", "Appointment completed");
    await this.notify(optional(request, "user_id"), "professional_appointment_completed", "Appointment updated", "Your professional appointment was marked complete.", requestId);
    return { appointmentId: value(data as Row, "id"), status: value(data as Row, "status") };
  }

  async addNote(userId: string, requestId: string, body: string) {
    const row = await this.assignedCase(userId, requestId);
    if (row.status === "closed" || row.status === "declined")
      throw new ConflictError("CASE_CLOSED", "This case is closed.");
    const { data, error } = await this.database
      .schema("professional_service")
      .from("case_notes")
      .insert({ request_id: requestId, author_user_id: userId, body_encrypted: encryptText(body, this.encryption) })
      .select("id")
      .single();
    if (error) throw databaseError("The case note could not be saved.");
    return { noteId: data.id as string };
  }

  async addReferral(userId: string, requestId: string, resourceName: string, resourceUrl: string | null) {
    const row = await this.assignedCase(userId, requestId);
    if (row.status === "closed" || row.status === "declined")
      throw new ConflictError("CASE_CLOSED", "This case is closed.");
    const { data, error } = await this.database
      .schema("professional_service")
      .from("referrals")
      .insert({ request_id: requestId, author_user_id: userId, resource_name: resourceName, resource_url: resourceUrl })
      .select("id")
      .single();
    if (error) throw databaseError("The referral could not be saved.");
    await this.event(requestId, userId, "referral_added", "Referral added");
    return { referralId: data.id as string };
  }

  async directory(input: {
    query?: string;
    organizationId?: string;
    specialization?: string;
    serviceType?: string;
    consultationMethod?: string;
    location?: string;
    cursor?: string;
    limit: number;
  }) {
    let profileQuery = this.database
      .schema("professional_service")
      .from("practitioner_profiles")
      .select("id,membership_id,bio,specialties,service_types,consultation_methods,location_label,response_hours,accepting_requests,created_at")
      .eq("discoverable", true)
      .eq("accepting_requests", true)
      .order("created_at", { ascending: false })
      .limit(input.limit + 1);
    if (input.specialization) profileQuery = profileQuery.contains("specialties", [input.specialization]);
    if (input.serviceType) profileQuery = profileQuery.contains("service_types", [input.serviceType]);
    if (input.consultationMethod) profileQuery = profileQuery.contains("consultation_methods", [input.consultationMethod]);
    if (input.location) profileQuery = profileQuery.ilike("location_label", `%${input.location}%`);
    if (input.cursor) profileQuery = profileQuery.lt("created_at", input.cursor);
    const { data: profileData, error: profileError } = await profileQuery;
    if (profileError) throw databaseError("Practitioners could not be loaded.");
    const profiles = ((profileData ?? []) as Row[]).slice(0, input.limit);
    if (profiles.length === 0) return { practitioners: [], nextCursor: null };
    const nextCursor = (profileData?.length ?? 0) > input.limit
      ? value(profiles[profiles.length - 1], "created_at")
      : null;
    const { data: memberData, error: memberError } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,organization_id,role,status,display_name,credential_label,credential_expires_at")
      .in("id", profiles.map((item) => value(item, "membership_id")))
      .eq("status", "active");
    if (memberError) throw databaseError("Practitioners could not be loaded.");
    const members = (memberData ?? []) as Row[];
    const eligible = members.filter((item) =>
      CLINICAL_ROLES.has(value(item, "role") as ProfessionalRole) &&
      value(item, "credential_expires_at") >= new Date().toISOString().slice(0, 10) &&
      (!input.organizationId || value(item, "organization_id") === input.organizationId),
    );
    if (eligible.length === 0) return { practitioners: [], nextCursor };
    const { data: organizationData, error: organizationError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("id,name,status")
      .in("id", [...new Set(eligible.map((item) => value(item, "organization_id")))])
      .eq("status", "active")
      .eq("accepting_requests", true);
    if (organizationError) throw databaseError("Practitioners could not be loaded.");
    const organizations = new Map(((organizationData ?? []) as Row[]).map((item) => [value(item, "id"), item]));
    const memberById = new Map(eligible.map((item) => [value(item, "id"), item]));
    const term = input.query?.trim().toLocaleLowerCase();
    const practitioners = profiles.flatMap((profile) => {
      const member = memberById.get(value(profile, "membership_id"));
      const organization = member ? organizations.get(value(member, "organization_id")) : undefined;
      if (!member || !organization) return [];
      const haystack = [value(member, "display_name"), value(member, "credential_label"), value(organization, "name"),
        ...strings(profile, "specialties")].join(" ").toLocaleLowerCase();
      if (term && !haystack.includes(term)) return [];
      return [{
        id: value(profile, "id"),
        organizationId: value(member, "organization_id"),
        organizationName: value(organization, "name"),
        displayName: value(member, "display_name"),
        role: value(member, "role"),
        credentialLabel: optional(member, "credential_label"),
        bio: value(profile, "bio"),
        specialties: strings(profile, "specialties"),
        serviceTypes: strings(profile, "service_types"),
        consultationMethods: strings(profile, "consultation_methods"),
        location: value(profile, "location_label"),
        responseHours: value(profile, "response_hours"),
        acceptingRequests: Boolean(profile.accepting_requests),
      }];
    }).slice(0, input.limit);
    return {
      practitioners,
      nextCursor,
    };
  }

  async hub(userId: string) {
    const [{ requests }, { organizations }, directory] = await Promise.all([
      this.listOwnRequests(userId),
      this.listOrganizations(),
      this.directory({ limit: 4 }),
    ]);
    let active = requests.filter((item) => ["submitted", "assigned", "scheduled"].includes(item.status));
    const assignedIds = [...new Set(active.flatMap((item) => item.assignedTo ? [item.assignedTo] : []))];
    if (assignedIds.length > 0) {
      const { data: members, error: memberError } = await this.database.schema("professional_service").from("memberships")
        .select("id,user_id,organization_id,role,display_name,credential_label").in("user_id", assignedIds).eq("status", "active");
      if (memberError) throw databaseError("Assigned professionals could not be loaded.");
      const memberRows = (members ?? []) as Row[];
      const { data: profiles, error: profileError } = await this.database.schema("professional_service").from("practitioner_profiles")
        .select("id,membership_id,bio,specialties,service_types,consultation_methods,location_label,response_hours,accepting_requests")
        .in("membership_id", memberRows.map((item) => value(item, "id")));
      if (profileError) throw databaseError("Assigned professionals could not be loaded.");
      const profileByMember = new Map(((profiles ?? []) as Row[]).map((item) => [value(item, "membership_id"), item]));
      const organizationById = new Map(organizations.map((item) => [item.id, item]));
      const assignedByUser = new Map(memberRows.flatMap((member) => {
        const profile = profileByMember.get(value(member, "id"));
        const organization = organizationById.get(value(member, "organization_id"));
        if (!profile || !organization) return [];
        return [[value(member, "user_id"), {
          id: value(profile, "id"), organizationId: organization.id, organizationName: organization.name,
          displayName: value(member, "display_name"), role: value(member, "role"), credentialLabel: optional(member, "credential_label"),
          bio: value(profile, "bio"), specialties: strings(profile, "specialties"), serviceTypes: strings(profile, "service_types"),
          consultationMethods: strings(profile, "consultation_methods"), location: value(profile, "location_label"),
          responseHours: value(profile, "response_hours"), acceptingRequests: Boolean(profile.accepting_requests),
        }] as const];
      }));
      active = active.map((item) => ({ ...item, assignedProfessional: item.assignedTo ? assignedByUser.get(item.assignedTo) ?? null : null }));
    }
    const requestIds = active.map((item) => item.id);
    let appointments: Array<Record<string, unknown>> = [];
    let unreadCount = 0;
    let recentMessages: Array<{ id: string; requestId: string; sender: string; body: string; createdAt: string }> = [];
    if (requestIds.length > 0) {
      const [appointmentResult, messageResult, readResult, recentMessageResult] = await Promise.all([
        this.database.schema("professional_service").from("appointments")
          .select("id,request_id,starts_at,ends_at,mode,location_hint_encrypted,status")
          .in("request_id", requestIds).in("status", ["proposed", "confirmed"])
          .gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
        this.database.schema("professional_service").from("case_messages")
          .select("request_id,sender_user_id,created_at").in("request_id", requestIds).neq("sender_user_id", userId),
        this.database.schema("professional_service").from("case_message_read_state")
          .select("request_id,last_read_at").eq("participant_user_id", userId).in("request_id", requestIds),
        this.database.schema("professional_service").from("case_messages")
          .select("id,request_id,sender_kind,body_encrypted,created_at")
          .in("request_id", requestIds).order("created_at", { ascending: false }).limit(3),
      ]);
      if (appointmentResult.error || messageResult.error || readResult.error || recentMessageResult.error) throw databaseError("Professional support could not be loaded.");
      appointments = ((appointmentResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"), requestId: value(item, "request_id"), startsAt: value(item, "starts_at"),
        endsAt: value(item, "ends_at"), mode: value(item, "mode"),
        locationHint: decryptText(item.location_hint_encrypted, this.encryption), status: value(item, "status"),
      }));
      const readAt = new Map(((readResult.data ?? []) as Row[]).map((item) => [value(item, "request_id"), value(item, "last_read_at")]));
      unreadCount = ((messageResult.data ?? []) as Row[]).filter((item) => value(item, "created_at") > (readAt.get(value(item, "request_id")) ?? "")).length;
      recentMessages = ((recentMessageResult.data ?? []) as Row[]).map((item) => ({
        id: value(item, "id"), requestId: value(item, "request_id"), sender: value(item, "sender_kind"),
        body: decryptText(item.body_encrypted, this.encryption), createdAt: value(item, "created_at"),
      }));
    }
    return {
      activeCases: active,
      recentCases: requests.slice(0, 6),
      upcomingAppointment: appointments[0] ?? null,
      unreadCount,
      recentMessages,
      organizations,
      discoveryPreview: directory.practitioners,
    };
  }

  private async caseParticipant(userId: string, requestId: string): Promise<{ row: Row; kind: "user" | "professional" }> {
    const row = await this.requestRow(requestId);
    if (row.user_id === userId) return { row, kind: "user" };
    if (row.assigned_to !== userId) throw new NotFoundError("The support request was not found.");
    await this.membership(userId, value(row, "organization_id"), true);
    return { row, kind: "professional" };
  }

  async messages(userId: string, requestId: string, before: string | undefined, limit: number) {
    await this.caseParticipant(userId, requestId);
    let query = this.database.schema("professional_service").from("case_messages")
      .select("id,request_id,sender_kind,body_encrypted,created_at")
      .eq("request_id", requestId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw databaseError("Case messages could not be loaded.");
    const rows = (data ?? []) as Row[];
    return {
      messages: rows.slice(0, limit).reverse().map((item) => ({
        id: value(item, "id"), requestId: value(item, "request_id"), sender: value(item, "sender_kind"),
        body: decryptText(item.body_encrypted, this.encryption), createdAt: value(item, "created_at"),
      })),
      nextCursor: rows.length > limit ? value(rows[limit - 1], "created_at") : null,
    };
  }

  async sendMessage(userId: string, requestId: string, clientMessageId: string, body: string) {
    const participant = await this.caseParticipant(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").rpc("send_case_message", {
      p_request_id: requestId, p_actor: userId, p_client_message_id: clientMessageId,
      p_body_encrypted: encryptText(body, this.encryption),
    });
    if (error) {
      if (error.message.includes("MESSAGE_NOT_ALLOWED")) throw new ConflictError("MESSAGE_NOT_ALLOWED", "Messaging is read-only for this case.");
      if (error.message.includes("REQUEST_NOT_FOUND")) throw new NotFoundError();
      throw databaseError("Your message could not be sent.");
    }
    const row = data as Row;
    await this.notify(
      participant.kind === "professional" ? optional(participant.row, "user_id") : optional(participant.row, "assigned_to"),
      "professional_case_message",
      "New professional support message",
      "A new message is available in your support case.",
      requestId,
    );
    return { message: { id: value(row, "id"), requestId, sender: value(row, "sender_kind"), body, createdAt: value(row, "created_at") } };
  }

  async markMessagesRead(userId: string, requestId: string) {
    await this.caseParticipant(userId, requestId);
    const { error } = await this.database.schema("professional_service").from("case_message_read_state").upsert({
      request_id: requestId, participant_user_id: userId, last_read_at: new Date().toISOString(),
    }, { onConflict: "request_id,participant_user_id" });
    if (error) throw databaseError("Message status could not be updated.");
    return { read: true };
  }

  async sharing(userId: string, requestId: string) {
    const { row, kind } = await this.caseParticipant(userId, requestId);
    let query = this.database.schema("professional_service").from("case_shared_records")
      .select("id,resource_type,source_record_id,label_encrypted,granted_at,expires_at,revoked_at")
      .eq("request_id", requestId).order("granted_at", { ascending: false });
    if (kind === "professional") query = query.is("revoked_at", null).gt("expires_at", new Date().toISOString());
    const { data, error } = await query;
    if (error) throw databaseError("Shared records could not be loaded.");
    if (kind === "professional" && (!sharingActive(row) || ["closed", "declined", "withdrawn"].includes(value(row, "status"))))
      return { records: [] };
    return { records: ((data ?? []) as Row[]).map((item) => ({
      id: value(item, "id"), resourceType: value(item, "resource_type"), sourceRecordId: value(item, "source_record_id"),
      label: decryptText(item.label_encrypted, this.encryption), grantedAt: value(item, "granted_at"),
      expiresAt: value(item, "expires_at"), revokedAt: optional(item, "revoked_at"),
    })) };
  }

  async revokeSharedRecord(userId: string, requestId: string, shareId: string) {
    const { row, kind } = await this.caseParticipant(userId, requestId);
    if (kind !== "user" || row.user_id !== userId) throw new NotFoundError();
    const { data, error } = await this.database.schema("professional_service").rpc("revoke_shared_record", {
      p_share_id: shareId, p_actor: userId,
    });
    if (error) {
      if (error.message.includes("SHARING_NOT_FOUND")) throw new NotFoundError();
      throw databaseError("Sharing could not be stopped.");
    }
    return { shareId: value(data as Row, "id"), revokedAt: value(data as Row, "revoked_at") };
  }

  async addSharing(userId: string, requestId: string, input: { journalIds: string[]; phq8Ids: string[] }) {
    const { row, kind } = await this.caseParticipant(userId, requestId);
    if (kind !== "user" || !sharingActive(row) || !["submitted", "assigned", "scheduled"].includes(value(row, "status")))
      throw new ConflictError("SHARING_EXPIRED", "New records cannot be shared with this case.");
    const journalIds = [...new Set(input.journalIds)];
    const phq8Ids = [...new Set(input.phq8Ids)];
    if (journalIds.length !== input.journalIds.length || phq8Ids.length !== input.phq8Ids.length)
      throw new ConflictError("DUPLICATE_RECORD", "Choose each record only once.");
    const journals = await Promise.all(journalIds.map(async (journalId) => {
      const journal = await this.journals.get(userId, journalId);
      return {
        request_id: requestId, owner_user_id: userId, resource_type: "journal", source_record_id: journalId,
        label_encrypted: encryptText(journal.title || "Untitled reflection", this.encryption),
        payload_encrypted: encryptText(journal.body, this.encryption), consent_version: PROFESSIONAL_CONSENT_VERSION,
        expires_at: value(row, "sharing_expires_at"),
      };
    }));
    const phq8 = (await this.phq8Snapshots(userId, phq8Ids)).map((item) => ({
      request_id: requestId, owner_user_id: userId, resource_type: item.resourceType, source_record_id: item.sourceRecordId,
      label_encrypted: item.labelEncrypted, payload_encrypted: item.payloadEncrypted,
      consent_version: PROFESSIONAL_CONSENT_VERSION, expires_at: value(row, "sharing_expires_at"),
    }));
    const records = [...journals, ...phq8];
    if (records.length === 0) return this.sharing(userId, requestId);
    const { error } = await this.database.schema("professional_service").from("case_shared_records").insert(records);
    if (error) {
      if (error.code === "23505") throw new ConflictError("RECORD_ALREADY_SHARED", "One of these records is already shared.");
      throw databaseError("The selected records could not be shared.");
    }
    await this.database.schema("professional_service").from("audit_events").insert({
      organization_id: value(row, "organization_id"), request_id: requestId, actor_user_id: userId, action: "sharing.records_added",
    });
    return this.sharing(userId, requestId);
  }

  async timeline(userId: string, requestId: string) {
    await this.caseParticipant(userId, requestId);
    const { data, error } = await this.database.schema("professional_service").from("case_events")
      .select("id,event_type,label,created_at").eq("request_id", requestId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw databaseError("Case history could not be loaded.");
    return { events: ((data ?? []) as Row[]).map((item) => ({
      id: value(item, "id"), type: value(item, "event_type"), label: value(item, "label"), createdAt: value(item, "created_at"),
    })) };
  }

  async withdraw(userId: string, requestId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("withdraw_request", {
      p_request_id: requestId, p_actor: userId,
    });
    if (error) {
      if (error.message.includes("CASE_NOT_ACTIVE")) throw new ConflictError("CASE_NOT_ACTIVE", "This request can no longer be withdrawn.");
      throw databaseError("The support request could not be withdrawn.");
    }
    await this.notify(optional(data as Row, "assigned_to"), "professional_case_withdrawn", "Support request withdrawn", "A support request assigned to you was withdrawn.", requestId);
    return { request: mapRequest(data as Row) };
  }

  async addUserCaseEvent(userId: string, requestId: string, type: "reassignment_requested" | "concern_reported", label: string) {
    const { row, kind } = await this.caseParticipant(userId, requestId);
    if (kind !== "user" || !["assigned", "scheduled"].includes(value(row, "status")))
      throw new ConflictError("CASE_NOT_ACTIVE", "This action is not available for the case.");
    const { data, error } = await this.database.schema("professional_service").from("case_events")
      .insert({ request_id: requestId, actor_user_id: userId, event_type: type, label }).select("id").single();
    if (error) throw databaseError("Your request could not be recorded.");
    await this.notify(optional(row, "assigned_to"), "professional_case_action", "Case action requested", "A user action needs your review.", requestId);
    return { eventId: data.id as string };
  }

  async listOwnAppointments(userId: string, range: { from?: string; to?: string } = {}) {
    let query = this.database.schema("professional_service").from("appointments")
      .select("id,request_id,starts_at,ends_at,mode,location_hint_encrypted,status,support_requests!inner()")
      .eq("support_requests.user_id", userId);
    if (range.from && range.to) query = query.gte("starts_at", range.from).lt("starts_at", range.to);
    const { data, error } = await query.order("starts_at", { ascending: false }).limit(100);
    if (error) throw databaseError("Appointments could not be loaded.");
    return { appointments: ((data ?? []) as Row[]).map((item) => ({
      id: value(item, "id"), requestId: value(item, "request_id"), startsAt: value(item, "starts_at"),
      endsAt: value(item, "ends_at"), mode: value(item, "mode"),
      locationHint: decryptText(item.location_hint_encrypted, this.encryption), status: value(item, "status"),
    })) };
  }

  async requestAppointmentChange(userId: string, appointmentId: string, preferredTime: string) {
    const { data: appointment, error } = await this.database.schema("professional_service").from("appointments")
      .select("id,request_id,status").eq("id", appointmentId).maybeSingle();
    if (error) throw databaseError("The appointment could not be loaded.");
    if (!appointment || !["proposed", "confirmed"].includes(appointment.status as string))
      throw new ConflictError("APPOINTMENT_UNAVAILABLE", "This appointment can no longer be changed.");
    const { kind } = await this.caseParticipant(userId, appointment.request_id as string);
    if (kind !== "user") throw new NotFoundError();
    const { data, error: insertError } = await this.database.schema("professional_service").from("appointment_change_requests")
      .insert({ appointment_id: appointmentId, requester_user_id: userId, preferred_time_encrypted: encryptText(preferredTime, this.encryption) })
      .select("id").single();
    if (insertError) {
      if (insertError.code === "23505") throw new ConflictError("APPOINTMENT_CONFLICT", "A change request is already pending.");
      throw databaseError("The appointment change could not be requested.");
    }
    await this.event(appointment.request_id as string, userId, "appointment_change_requested", "Appointment change requested");
    return { changeRequestId: data.id as string };
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
      if (error.code === "23505")
        throw new ConflictError("ORGANIZATION_EXISTS", "This organization slug is already used.");
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
    if (error) throw databaseError("Professional organizations could not be loaded.");
    return { organizations: ((data ?? []) as Row[]).map(mapOrganization) };
  }

  async listMembersForAdmin(organizationId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("memberships")
      .select("id,user_id,role,status,display_name,credential_label,credential_expires_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw databaseError("Organization members could not be loaded.");
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

  async listAuditForAdmin(organizationId: string) {
    const { data, error } = await this.database
      .schema("professional_service")
      .from("audit_events")
      .select("id,action,actor_user_id,subject_user_id,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw databaseError("Recent professional activity could not be loaded.");
    return {
      events: ((data ?? []) as Row[]).map((row) => ({
        id: value(row, "id"),
        action: value(row, "action"),
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
    if (error) throw databaseError("The organization could not be approved.");
    if (!data) throw new ConflictError("ORGANIZATION_UNAVAILABLE", "This organization cannot be approved.");
    return { organization: mapOrganization(data as Row) };
  }

  async suspendOrganization(adminId: string, organizationId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("suspend_organization", {
      p_organization_id: organizationId,
      p_actor: adminId,
    });
    if (error) {
      if (error.message.includes("ORGANIZATION_UNAVAILABLE"))
        throw new ConflictError("ORGANIZATION_UNAVAILABLE", "This organization is not active.");
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
    },
  ) {
    const { data: organization, error: orgError } = await this.database
      .schema("professional_service")
      .from("organizations")
      .select("status")
      .eq("id", input.organizationId)
      .maybeSingle();
    if (orgError) throw databaseError("Organization access could not be checked.");
    if (organization?.status !== "active")
      throw new AuthorizationError("Approve the organization before adding staff.");
    const { data: profile, error: profileError } = await this.database
      .schema("user_service")
      .from("profiles")
      .select("account_status,eligible_18_plus,onboarding_completed")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (profileError) throw databaseError("The staff account could not be checked.");
    if (
      profile?.account_status !== "active" ||
      profile.eligible_18_plus !== true ||
      profile.onboarding_completed !== true
    )
      throw new AuthorizationError("The staff member needs an active eligible ECHO account before approval.");
    if (
      CLINICAL_ROLES.has(input.role) &&
      (!input.credentialLabel ||
        !input.credentialExpiresAt ||
        input.credentialExpiresAt < new Date().toISOString().slice(0, 10))
    )
      throw new AuthorizationError("A reviewed, unexpired practitioner credential is required.");
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
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      )
      .select("id")
      .single();
    if (error) throw databaseError("Professional access could not be approved.");
    return { membershipId: data.id as string };
  }

  async suspendMember(adminId: string, membershipId: string) {
    const { data, error } = await this.database.schema("professional_service").rpc("suspend_member", {
      p_membership_id: membershipId,
      p_actor: adminId,
    });
    if (error) {
      if (error.message.includes("MEMBERSHIP_UNAVAILABLE"))
        throw new ConflictError("MEMBERSHIP_UNAVAILABLE", "This professional access is not active.");
      throw databaseError("Professional access could not be suspended.");
    }
    return { membershipId: value(data as Row, "id"), status: "suspended" };
  }
}
