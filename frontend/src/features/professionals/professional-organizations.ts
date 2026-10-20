import type { Membership } from "@/services/professionals/professional-api";

export function approvedOrganizations(memberships: Membership[]) {
  return memberships.filter((item) => item.accessState === "active" && item.status === "active" && item.organization?.status === "active");
}

export const professionalRoleLabel = (role: string) => ({
  counselor: "Counselor", psychologist: "Psychologist", social_worker: "Social worker",
  coordinator: "Coordinator", org_admin: "Organization administrator",
}[role] ?? "Professional role unavailable");

export function organizationAccessLabel(member: Membership) {
  if (!member.organization || (member.accessState === "active" && (member.status !== "active" || member.organization.status !== "active"))) return "Organization unavailable";
  return {
    active: "Approved", pending_organization: "Organization review pending", suspended_organization: "Organization suspended",
    pending_membership: "Membership pending", suspended_membership: "Membership suspended", credential_expired: "Credential expired",
  }[member.accessState];
}
