import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type {
  CaseEvent,
  CaseMessage,
  CreateProfessionalRequest,
  PractitionerProfile,
  ProfessionalAppointment,
  ProfessionalOrganization,
  SharedRecord,
  SupportRequest,
} from "@echo/contracts";

interface Envelope<T> {
  success: true;
  data: T;
}
export type Organization = ProfessionalOrganization;
export type { CaseEvent, CaseMessage, PractitionerProfile, ProfessionalAppointment, SharedRecord, SupportRequest };
export interface Membership {
  id: string;
  organizationId: string;
  organization: Organization | null;
  role: string;
  status: string;
  displayName: string;
  credentialLabel: string | null;
  credentialExpiresAt: string | null;
  accessState:
    | "active"
    | "pending_organization"
    | "suspended_organization"
    | "pending_membership"
    | "suspended_membership"
    | "credential_expired";
}
export type ClinicalRole = "counselor" | "psychologist" | "social_worker";
export interface CredentialSubmission {
  organizationId: string; role: ClinicalRole; credentialLabel: string; expiresAt: string; evidenceReference: string;
}
export interface CredentialReview {
  id: string; organizationId: string; userId: string; role: ClinicalRole; credentialLabel: string; expiresAt: string;
  status: "pending" | "approved" | "rejected" | "expired"; reviewStatus: "pending" | "approved" | "rejected";
  submittedAt: string; reviewedAt: string | null; reviewedBy: string | null;
  reasonCode: "invalid_evidence" | "expired_credential" | "unable_to_verify" | null;
}
export type CredentialDecision = { decision: "approved"; reasonCode: null } | { decision: "rejected"; reasonCode: Exclude<CredentialReview["reasonCode"], null> };
export interface AdminMembership {
  id: string;
  userId: string;
  role: string;
  status: string;
  displayName: string;
  credentialLabel: string | null;
  credentialExpiresAt: string | null;
}
export interface ProfessionalAuditEvent {
  id: string;
  action: string;
  actorUserId: string;
  subjectUserId: string | null;
  createdAt: string;
}
export type QueueRequest = Pick<
  SupportRequest,
  "id" | "organizationId" | "status" | "assignedTo" | "createdAt" | "updatedAt"
>;
export interface ProfessionalQueueFilters {
  status?: "submitted" | "assigned" | "scheduled" | "closed" | "declined";
  assignedTo?: string; createdFrom?: string; createdThrough?: string;
  sort?: "newest" | "oldest" | "updated"; limit?: number; offset?: number;
}
export interface ProfessionalQueuePage { offset: number; limit: number; total: number; hasMore: boolean }
export interface ProfessionalDashboardSummary {
  organizationId: string; userId: string; asOf: string;
  counts: { pendingCount: number; activeCount: number; scheduledCount: number };
  scheduledCases: QueueRequest[]; scheduledLimit: number;
  appointments: Array<Omit<Appointment, "locationHint"> & { requestId: string }>;
  appointmentTotal: number; appointmentLimit: number; clinicalAccess: boolean; followUpsAvailable: false;
}
export interface Appointment {
  id: string;
  replacesAppointmentId?: string | null;
  startsAt: string;
  endsAt: string;
  mode: string;
  locationHint: string;
  status: string;
}
export interface CaseDetail {
  messagingAvailable?: boolean;
  notesLifecycleAvailable?: boolean;
  closureReasonAvailable?: boolean;
  timeline?: { events: Array<{ id: string; action: string; at: string }>; hasMore: boolean; limit: number };
  request: SupportRequest;
  sharedJournals: Array<{ journalId: string; title: string; body: string }>;
  sharedPhq8: Array<{ id: string; label: string; score: number; severity: string; completedAt: string; context: string }>;
  appointments: Appointment[];
  appointmentChangeRequests: Array<{ id: string; appointmentId: string; preferredTime: string; status: string; createdAt: string }>;
  referrals: Array<{ id: string; resourceName: string; resourceUrl: string | null; createdAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string; state?: "draft" | "final"; revision?: number; updatedAt?: string; finalizedAt?: string | null }>;
  viewer: "user" | "professional";
}

export interface ProfessionalNotification {
  id: string;
  kind: "case_updated" | "appointment_changed" | "follow_up" | "referral_updated" | "case_message";
  caseId: string;
  readAt: string | null;
  createdAt: string;
}
export interface ProfessionalNotificationPage {
  items: ProfessionalNotification[]; total: number; hasMore: boolean; limit: number;
  /** Optional until the scoped inbox migration is applied. Never infer exact totals from a bounded page. */
  unreadCount?: number; inAppEnabled?: boolean;
}

export interface ProfessionalFollowUp {
  id: string; caseId: string; organizationId: string; title: string; dueAt: string;
  status: "pending" | "completed"; responsibleUserId: string; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
}
export interface FollowUpInput { title: string; dueAt: string }
export interface ProfessionalHub {
  activeCases: SupportRequest[];
  recentCases: SupportRequest[];
  upcomingAppointment: ProfessionalAppointment | null;
  unreadCount: number;
  recentMessages: CaseMessage[];
  organizations: Organization[];
  discoveryPreview: PractitionerProfile[];
}

const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
const get = async <T>(path: string, signal?: AbortSignal) => (await (signal ? client.get<Envelope<T>>(path, { signal }) : client.get<Envelope<T>>(path))).data;
const post = async <T>(path: string, input: unknown) => (await client.post<Envelope<T>, unknown>(path, input)).data;
const patch = async <T>(path: string, input: unknown) => (await client.patch<Envelope<T>, unknown>(path, input)).data;
const remove = async <T>(path: string) => (await client.delete<Envelope<T>>(path)).data;

export const professionalApi = {
  correctCredential: (id: string, input: { credentialLabel: string; expiresAt: string }) => patch<{ credential: CredentialReview }>("/professional/credentials/" + encodeURIComponent(id), input),
  journalChoices: async () => {
    const result = await get<{ entries: Array<{ id: string; title: string; created_at: string }> }>("/journals");
    return result.entries.map((item) => ({ id: item.id, title: item.title, createdAt: item.created_at }));
  },
  organizations: () => get<{ organizations: Organization[] }>("/professional/organizations"),
  hub: (signal?: AbortSignal) => get<ProfessionalHub>("/professional/hub", signal),
  directory: (filters: {
    query?: string;
    organizationId?: string;
    specialization?: string;
    serviceType?: string;
    consultationMethod?: string;
    location?: string;
    cursor?: string;
    limit?: number;
  } = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
    return get<{ practitioners: PractitionerProfile[]; nextCursor: string | null }>(
      `/professional/directory${params.size ? `?${params}` : ""}`,
      signal,
    );
  },
  memberships: () => get<{ userId: string; mfaRequired: boolean; memberships: Membership[] }>("/professional/me"),
  ownRequests: () => get<{ requests: SupportRequest[] }>("/professional/my-requests"),
  createRequest: (input: CreateProfessionalRequest) => post<{ request: SupportRequest }>("/professional/my-requests", input),
  ownDetail: (id: string) => get<CaseDetail>(`/professional/my-requests/${id}`),
  updateOwnRequest: async (id: string, input: { summary: string; preferredTime: string }) =>
    (await client.patch<Envelope<{ request: SupportRequest }>>(`/professional/my-requests/${id}`, input)).data,
  withdrawOwnRequest: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/cancel`, {}),
  revoke: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/revoke`, {}),
  withdraw: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/withdraw`, {}),
  requestReassignment: (id: string, reason: string) =>
    post<{ eventId: string }>(`/professional/my-requests/${id}/reassignment-requests`, { reason }),
  reportConcern: (id: string, category: "privacy" | "communication" | "conduct" | "other") =>
    post<{ eventId: string }>(`/professional/my-requests/${id}/concerns`, { category }),
  sharing: (id: string) => get<{ records: SharedRecord[] }>(`/professional/my-requests/${id}/sharing`),
  addSharing: (id: string, input: { journalIds: string[]; phq8Ids: string[]; consent: true }) =>
    post<{ records: SharedRecord[] }>(`/professional/my-requests/${id}/sharing`, input),
  revokeSharedRecord: (id: string, shareId: string) =>
    remove<{ shareId: string; revokedAt: string }>(`/professional/my-requests/${id}/sharing/${shareId}`),
  timeline: (id: string) => get<{ events: CaseEvent[] }>(`/professional/my-requests/${id}/timeline`),
  messages: (id: string, before?: string) => get<{ messages: CaseMessage[]; nextCursor: string | null }>(
    `/professional/my-requests/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  ),
  sendMessage: (id: string, input: { clientMessageId: string; body: string }) =>
    post<{ message: CaseMessage }>(`/professional/my-requests/${id}/messages`, input),
  markMessagesRead: (id: string) => patch<{ read: true }>(`/professional/my-requests/${id}/messages/read`, {}),
  appointments: (range?: { from: string; to: string }, signal?: AbortSignal) => {
    const params = range ? `?${new URLSearchParams(range)}` : "";
    return get<{ appointments: ProfessionalAppointment[] }>(`/professional/appointments${params}`, signal);
  },
  requestAppointmentChange: (id: string, preferredTime: string) =>
    post<{ changeRequestId: string }>(`/professional/appointments/${id}/change-requests`, { preferredTime }),
  respondAppointment: (id: string, accept: boolean) =>
    post<{ appointmentId: string; status: string; warning?: string }>(`/professional/appointments/${id}/respond`, { accept }),
  rescheduleAppointment: (id: string, input: { startsAt: string; endsAt: string; mode: "in_person" | "online" | "phone"; locationHint: string }) => post<{ appointmentId: string; status: string; warning?: string }>(`/professional/appointments/${id}/reschedule`, input),
  cancelAppointment: (id: string) =>
    post<{ appointmentId: string; status: string; warning?: string }>(`/professional/appointments/${id}/cancel`, {}),
  queue: (organizationId: string, filters?: ProfessionalQueueFilters) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters ?? {})) if (value !== undefined) query.set(key, String(value));
    const suffix = query.size ? `?${query.toString()}` : "";
    return get<{ requests: QueueRequest[]; page?: ProfessionalQueuePage }>(`/professional/organizations/${organizationId}/queue${suffix}`);
  },
  notifications: (organizationId: string) => get<ProfessionalNotificationPage>(`/professional/organizations/${encodeURIComponent(organizationId)}/notifications`),
  readNotification: (organizationId: string, notificationId: string) => patch<{ id: string; readAt: string }>(`/professional/organizations/${encodeURIComponent(organizationId)}/notifications/${encodeURIComponent(notificationId)}/read`, {}),
  dashboard: (organizationId: string) => get<ProfessionalDashboardSummary>(`/professional/organizations/${organizationId}/dashboard`),
  caseDetail: (id: string) => get<CaseDetail>(`/professional/cases/${id}`),
  followUps: (id: string) => get<{ items: ProfessionalFollowUp[]; total: number; hasMore: boolean; limit: number }>(`/professional/cases/${id}/follow-ups`),
  createFollowUp: (id: string, input: FollowUpInput & { submissionId: string }) => post<{ followUp: ProfessionalFollowUp }>(`/professional/cases/${id}/follow-ups`, input),
  editFollowUp: async (id: string, followUpId: string, input: FollowUpInput & { expectedRevision: number }) => (await client.patch<Envelope<{ followUp: ProfessionalFollowUp }>, typeof input>(`/professional/cases/${id}/follow-ups/${followUpId}`, input)).data,
  completeFollowUp: (id: string, followUpId: string, expectedRevision: number) => post<{ followUp: ProfessionalFollowUp }>(`/professional/cases/${id}/follow-ups/${followUpId}/complete`, { expectedRevision }),
  completeAppointment: (id: string) =>
    post<{ appointmentId: string; status: string; warning?: string }>(`/professional/appointments/${id}/complete`, {}),
  caseMessages: (id: string, before?: string) => get<{ messages: CaseMessage[]; nextCursor: string | null }>(
    `/professional/cases/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  ),
  sendCaseMessage: (id: string, input: { clientMessageId: string; body: string }) =>
    post<{ message: CaseMessage }>(`/professional/cases/${id}/messages`, input),
  markCaseMessagesRead: (id: string) => patch<{ read: true }>(`/professional/cases/${id}/messages/read`, {}),
  claim: (id: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/claim`, {}),
  assign: (id: string, profileId: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/assign`, { profileId }),
  proposeAppointment: (
    id: string,
    input: { startsAt: string; endsAt: string; mode: "in_person" | "online" | "phone"; locationHint: string },
  ) => post<{ appointmentId: string; warning?: string }>(`/professional/cases/${id}/appointments`, input),
  addNote: (id: string, body: string, options?: { submissionId: string; state?: "draft" | "final" }) => post<{ noteId: string; state?: string; revision?: number }>(`/professional/cases/${id}/notes`, { body, ...options }),
  editNote: async (id: string, noteId: string, input: { body: string; expectedRevision: number; finalize: boolean }) => (await client.patch<Envelope<{ noteId: string; state: string; revision: number }>, typeof input>(`/professional/cases/${id}/notes/${noteId}`, input)).data,
  addReferral: (id: string, resourceName: string, resourceUrl: string | null) =>
    post<{ referralId: string }>(`/professional/cases/${id}/referrals`, { resourceName, resourceUrl }),
  close: (id: string, reason?: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/close`, reason ? { reason } : {}),
  transfer: (id: string, input: { targetUserId: string; reason: string; submissionId: string }) => post<{ request: SupportRequest; transferId: string }>(`/professional/cases/${id}/transfer`, input),
  credentials: () => get<{ credentials: CredentialReview[] }>("/professional/credentials"),
  submitCredential: (input: CredentialSubmission) => post<{ credential: CredentialReview }>("/professional/credentials", input),
  adminCredentials: (organizationId: string) => get<{ credentials: CredentialReview[] }>("/professional/admin/organizations/" + encodeURIComponent(organizationId) + "/credentials"),
  adminCredential: (organizationId: string, credentialId: string) => get<{ credential: CredentialReview & { evidenceReference: string } }>("/professional/admin/organizations/" + encodeURIComponent(organizationId) + "/credentials/" + encodeURIComponent(credentialId)),
  decideCredential: (organizationId: string, credentialId: string, input: CredentialDecision) => post<{ credential: CredentialReview }>("/professional/admin/organizations/" + encodeURIComponent(organizationId) + "/credentials/" + encodeURIComponent(credentialId) + "/decision", input),
  adminOrganizations: () => get<{ organizations: Organization[] }>("/professional/admin/organizations"),
  adminMembers: (organizationId: string) =>
    get<{ memberships: AdminMembership[] }>(`/professional/admin/organizations/${organizationId}/memberships`),
  adminAudit: (organizationId: string) =>
    get<{ events: ProfessionalAuditEvent[] }>(`/professional/admin/organizations/${organizationId}/audit`),
  createOrganization: (input: { slug: string; name: string; description: string; serviceHours: string }) =>
    post<{ organization: Organization }>("/professional/admin/organizations", input),
  approveOrganization: (id: string) =>
    post<{ organization: Organization }>(`/professional/admin/organizations/${id}/approve`, {}),
  suspendOrganization: (id: string) =>
    post<{ organization: Organization }>(`/professional/admin/organizations/${id}/suspend`, {}),
  approveMember: (input: {
    organizationId: string;
    userId: string;
    role: "counselor" | "psychologist" | "social_worker" | "coordinator" | "org_admin";
    displayName: string;
    credentialLabel: string | null;
    credentialExpiresAt: string | null;
    credentialChecked: true;
    credentialId?: string;
  }) => post<{ membershipId: string }>("/professional/admin/memberships", input),
  suspendMember: (id: string) =>
    post<{ membershipId: string; status: string }>(`/professional/admin/memberships/${id}/suspend`, {}),
};
