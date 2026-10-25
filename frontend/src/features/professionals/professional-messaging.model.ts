import type { CaseDetail, CaseMessage } from "@/services/professionals/professional-api";
import { AppError } from "@/shared/errors/app-error";

/** Discard the clinical detail payload after checking eligibility; retain only these flags. */
export function messageEligibility(detail: CaseDetail, caseId: string, organizationId: string, userId: string) {
  if (detail.viewer !== "professional" || detail.request.id !== caseId || detail.request.organizationId !== organizationId || detail.request.assignedTo !== userId) throw new AppError({ userMessage: "Conversation access could not be verified", code: "AUTHORIZATION_ERROR", statusCode: 403 });
  return { available: detail.messagingAvailable === true, writable: detail.messagingAvailable === true && detail.request.sharingActive && ["assigned", "scheduled"].includes(detail.request.status) };
}
export function validateCaseMessages(messages: CaseMessage[], caseId: string) {
  if (messages.some(message => message.requestId !== caseId || !["user", "professional"].includes(message.sender))) throw new AppError({ userMessage: "Conversation scope could not be verified", code: "AUTHORIZATION_ERROR", statusCode: 403 });
  return messages;
}
export function mergeCaseMessages(older: CaseMessage[], newer: CaseMessage[]) {
  return [...new Map([...older, ...newer].map(message => [message.id, message])).values()];
}

export function validateSentCaseMessage(message: CaseMessage, caseId: string, body: string) {
  validateCaseMessages([message], caseId);
  if (message.sender !== "professional" || message.body !== body) throw new AppError({ code: "AUTHORIZATION_ERROR", statusCode: 403, userMessage: "Message acknowledgement could not be verified" });
  return message;
}
