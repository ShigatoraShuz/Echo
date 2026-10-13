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
export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: string;
  locationHint: string;
  status: string;
}
export interface CaseDetail {
  request: SupportRequest;
  sharedJournals: Array<{ journalId: string; title: string; body: string }>;
  sharedPhq8: Array<{ id: string; label: string; score: number; severity: string; completedAt: string; context: string }>;
  appointments: Appointment[];
  appointmentChangeRequests: Array<{ id: string; appointmentId: string; preferredTime: string; status: string; createdAt: string }>;
  referrals: Array<{ id: string; resourceName: string; resourceUrl: string | null; createdAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  viewer: "user" | "professional";
}

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
const get = async <T>(path: string, signal?: AbortSignal) => (await client.get<Envelope<T>>(path, { signal })).data;
const post = async <T>(path: string, input: unknown) => (await client.post<Envelope<T>, unknown>(path, input)).data;
const patch = async <T>(path: string, input: unknown) => (await client.patch<Envelope<T>, unknown>(path, input)).data;
const remove = async <T>(path: string) => (await client.delete<Envelope<T>>(path)).data;

export const professionalApi = {
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
  appointments: () => get<{ appointments: ProfessionalAppointment[] }>("/professional/appointments"),
  requestAppointmentChange: (id: string, preferredTime: string) =>
    post<{ changeRequestId: string }>(`/professional/appointments/${id}/change-requests`, { preferredTime }),
  respondAppointment: (id: string, accept: boolean) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/respond`, { accept }),
  cancelAppointment: (id: string) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/cancel`, {}),
  completeAppointment: (id: string) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/complete`, {}),
  queue: (organizationId: string) =>
    get<{ requests: QueueRequest[] }>(`/professional/organizations/${organizationId}/queue`),
  caseDetail: (id: string) => get<CaseDetail>(`/professional/cases/${id}`),
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
  ) => post<{ appointmentId: string }>(`/professional/cases/${id}/appointments`, input),
  addNote: (id: string, body: string) => post<{ noteId: string }>(`/professional/cases/${id}/notes`, { body }),
  addReferral: (id: string, resourceName: string, resourceUrl: string | null) =>
    post<{ referralId: string }>(`/professional/cases/${id}/referrals`, { resourceName, resourceUrl }),
  close: (id: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/close`, {}),
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
