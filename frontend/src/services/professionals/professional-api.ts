import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

interface Envelope<T> {
  success: true;
  data: T;
}
export interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string;
  serviceHours: string;
  status: string;
}
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
export interface SupportRequest {
  id: string;
  organizationId: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  preferredTime: string;
  sharingActive: boolean;
  sharedJournalCount: number;
  summary?: string | null;
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
  startsAt: string;
  endsAt: string;
  mode: string;
  locationHint: string;
  status: string;
}
export interface CaseDetail {
  notesLifecycleAvailable?: boolean;
  closureReasonAvailable?: boolean;
  timeline?: { events: Array<{ id: string; action: string; at: string }>; hasMore: boolean; limit: number };
  request: SupportRequest;
  sharedJournals: Array<{ journalId: string; title: string; body: string }>;
  appointments: Appointment[];
  referrals: Array<{ id: string; resourceName: string; resourceUrl: string | null; createdAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string; state?: "draft" | "final"; revision?: number; updatedAt?: string; finalizedAt?: string | null }>;
  viewer: "user" | "professional";
}

export interface ProfessionalFollowUp {
  id: string; caseId: string; organizationId: string; title: string; dueAt: string;
  status: "pending" | "completed"; responsibleUserId: string; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
}
export interface FollowUpInput { title: string; dueAt: string }

const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
const get = async <T>(path: string) => (await client.get<Envelope<T>>(path)).data;
const post = async <T>(path: string, input: unknown) => (await client.post<Envelope<T>, unknown>(path, input)).data;

export const professionalApi = {
  journalChoices: async () => {
    const result = await get<{ entries: Array<{ id: string; title: string; created_at: string }> }>("/journals");
    return result.entries.map((item) => ({ id: item.id, title: item.title, createdAt: item.created_at }));
  },
  organizations: () => get<{ organizations: Organization[] }>("/professional/organizations"),
  memberships: () => get<{ userId: string; mfaRequired: boolean; memberships: Membership[] }>("/professional/me"),
  ownRequests: () => get<{ requests: SupportRequest[] }>("/professional/my-requests"),
  createRequest: (input: {
    organizationId: string;
    summary: string;
    preferredTime: string;
    journalIds: string[];
    consent: true;
  }) => post<{ request: SupportRequest }>("/professional/my-requests", input),
  ownDetail: (id: string) => get<CaseDetail>(`/professional/my-requests/${id}`),
  updateOwnRequest: async (id: string, input: { summary: string; preferredTime: string }) =>
    (await client.patch<Envelope<{ request: SupportRequest }>>(`/professional/my-requests/${id}`, input)).data,
  withdrawOwnRequest: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/cancel`, {}),
  revoke: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/revoke`, {}),
  respondAppointment: (id: string, accept: boolean) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/respond`, { accept }),
  rescheduleAppointment: (id: string, input: { startsAt: string; endsAt: string; mode: "in_person" | "online" | "phone"; locationHint: string }) => post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/reschedule`, input),
  cancelAppointment: (id: string) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/cancel`, {}),
  queue: (organizationId: string, filters?: ProfessionalQueueFilters) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters ?? {})) if (value !== undefined) query.set(key, String(value));
    const suffix = query.size ? `?${query.toString()}` : "";
    return get<{ requests: QueueRequest[]; page?: ProfessionalQueuePage }>(`/professional/organizations/${organizationId}/queue${suffix}`);
  },
  dashboard: (organizationId: string) => get<ProfessionalDashboardSummary>(`/professional/organizations/${organizationId}/dashboard`),
  caseDetail: (id: string) => get<CaseDetail>(`/professional/cases/${id}`),
  followUps: (id: string) => get<{ items: ProfessionalFollowUp[]; total: number; hasMore: boolean; limit: number }>(`/professional/cases/${id}/follow-ups`),
  createFollowUp: (id: string, input: FollowUpInput & { submissionId: string }) => post<{ followUp: ProfessionalFollowUp }>(`/professional/cases/${id}/follow-ups`, input),
  editFollowUp: async (id: string, followUpId: string, input: FollowUpInput & { expectedRevision: number }) => (await client.patch<Envelope<{ followUp: ProfessionalFollowUp }>, typeof input>(`/professional/cases/${id}/follow-ups/${followUpId}`, input)).data,
  completeFollowUp: (id: string, followUpId: string, expectedRevision: number) => post<{ followUp: ProfessionalFollowUp }>(`/professional/cases/${id}/follow-ups/${followUpId}/complete`, { expectedRevision }),
  claim: (id: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/claim`, {}),
  proposeAppointment: (
    id: string,
    input: { startsAt: string; endsAt: string; mode: "in_person" | "online" | "phone"; locationHint: string },
  ) => post<{ appointmentId: string }>(`/professional/cases/${id}/appointments`, input),
  addNote: (id: string, body: string, options?: { submissionId: string; state?: "draft" | "final" }) => post<{ noteId: string; state?: string; revision?: number }>(`/professional/cases/${id}/notes`, { body, ...options }),
  editNote: async (id: string, noteId: string, input: { body: string; expectedRevision: number; finalize: boolean }) => (await client.patch<Envelope<{ noteId: string; state: string; revision: number }>, typeof input>(`/professional/cases/${id}/notes/${noteId}`, input)).data,
  addReferral: (id: string, resourceName: string, resourceUrl: string | null) =>
    post<{ referralId: string }>(`/professional/cases/${id}/referrals`, { resourceName, resourceUrl }),
  close: (id: string, reason?: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/close`, reason ? { reason } : {}),
  transfer: (id: string, input: { targetUserId: string; reason: string; submissionId: string }) => post<{ request: SupportRequest; transferId: string }>(`/professional/cases/${id}/transfer`, input),
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
  }) => post<{ membershipId: string }>("/professional/admin/memberships", input),
  suspendMember: (id: string) =>
    post<{ membershipId: string; status: string }>(`/professional/admin/memberships/${id}/suspend`, {}),
};
