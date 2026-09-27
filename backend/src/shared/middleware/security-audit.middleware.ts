import { createHash } from "node:crypto";
import type { RequestHandler } from "express";

export interface SecurityEvent {
  event: string;
  requestId: string;
  actorHash: string | null;
  outcome: "allowed" | "denied" | "failed";
  statusCode: number;
}
export type SecurityAuditSink = (event: SecurityEvent) => Promise<void>;
export function securityAuditMiddleware(sink: SecurityAuditSink): RequestHandler {
  return (request, response, next) => {
    response.on("finish", () => {
      const path = typeof request.route?.path === "string" ? request.route.path : "";
      const event = response.statusCode === 401 ? "authentication.denied" :
        response.statusCode === 403 ? "authorization.denied" : response.statusCode === 429 ? "rate_limit.denied" :
        path.includes("/admin/") ? "administrator.access" :
        path.includes("/data-exports") ? "privacy.export" : path.includes("account-deletion") ? "privacy.deletion" :
        path.includes("/consent") || path.includes("/privacy") || path.includes("/policies") ? "consent.access" :
        path.includes("/verification") ? "verification.access" : path.includes("/security/") ? "account.security" : null;
      if (!event) return;
      const payload: SecurityEvent = {
        event, requestId: request.requestId,
        actorHash: request.auth?.id ? createHash("sha256").update(request.auth.id).digest("hex") : null,
        statusCode: response.statusCode,
        outcome: response.statusCode >= 500 ? "failed" : response.statusCode >= 400 ? "denied" : "allowed",
      };
      // Payload is constructed here, never from request bodies, URLs or errors.
      void sink(payload).catch(() => console.error(JSON.stringify({ event: "security_audit_delivery_failed", requestId: request.requestId })));
    });
    next();
  };
}
