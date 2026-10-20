import { AppError } from "@/shared/errors/app-error";
export type { CaseDetail, Membership, Appointment, QueueRequest, SupportRequest } from "../../src/services/professionals/professional-api";
export type { SupportResource } from "../../src/services/experience/experience-api";
// The harness has no credentials, token provider or production API destination.
async function rpc(method: string, args: unknown[]) {
  const response = await fetch("/__fixtures/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, args }) });
  const result = await response.json();
  if (!response.ok) throw new AppError({ code: result.code, statusCode: response.status, userMessage: "Synthetic private diagnostic" });
  return result;
}
export const professionalApi = Object.fromEntries(["memberships", "dashboard", "queue", "caseDetail", "claim", "addNote", "close", "proposeAppointment", "cancelAppointment", "addReferral", "directory", "assign", "caseMessages", "markCaseMessagesRead", "sendCaseMessage", "completeAppointment"].map((method) => [method, (...args: unknown[]) => rpc(method, args)]));
export const experienceApi = { getSupportResources: (...args: unknown[]) => rpc("resources", args) };
export const getAuthService = () => ({ getCurrentSession: async () => ({ success: true, data: null }), logout: async () => ({ success: true }), login: (...args: unknown[]) => rpc("login", args), sendLoginCode: (...args: unknown[]) => rpc("sendLoginCode", args), verifyLoginCode: (...args: unknown[]) => rpc("verifyLoginCode", args) });
export type ReviewerFactor = { id: string };
export const prepareReviewerMfa = () => rpc("prepareMfa", []);
export const verifyReviewerMfa = (...args: unknown[]) => rpc("verifyMfa", args);
