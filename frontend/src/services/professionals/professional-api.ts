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
  appointments: Appointment[];
  referrals: Array<{ id: string; resourceName: string; resourceUrl: string | null; createdAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  viewer: "user" | "professional";
}

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
  revoke: (id: string) => post<{ request: SupportRequest }>(`/professional/my-requests/${id}/revoke`, {}),
  respondAppointment: (id: string, accept: boolean) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/respond`, { accept }),
  cancelAppointment: (id: string) =>
    post<{ appointmentId: string; status: string }>(`/professional/appointments/${id}/cancel`, {}),
  queue: (organizationId: string) =>
    get<{ requests: QueueRequest[] }>(`/professional/organizations/${organizationId}/queue`),
  caseDetail: (id: string) => get<CaseDetail>(`/professional/cases/${id}`),
  claim: (id: string) => post<{ request: SupportRequest }>(`/professional/cases/${id}/claim`, {}),
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
