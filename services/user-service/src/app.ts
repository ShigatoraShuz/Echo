import express, { Router } from "express";
import { asyncRoute, createServiceApp, requireGatewayUser, requireInternalToken, sendData, ServiceError } from "@echo/service-core";
import { z } from "zod";
import { createOnboardingController } from "./features/onboarding/onboarding.controller.js";
import type { OnboardingService } from "./features/onboarding/onboarding.service.js";
import { createSettingsController } from "./features/settings/settings.controller.js";
import type { SettingsService } from "./features/settings/settings.service.js";
import { createVerificationController } from "./features/verification/verification.controller.js";
import type { VerificationService } from "./features/verification/verification.service.js";

export type UserServiceDependencies = { onboarding: OnboardingService; settings: SettingsService; verification: VerificationService; database: { from(table: string): any } };

export function createUserApp(dependencies: UserServiceDependencies, options: { internalToken: string; allowedOrigin?: string }) {
  const router = Router();
  const user = requireGatewayUser(options.internalToken);
  const internal = requireInternalToken(options.internalToken);
  const onboarding = createOnboardingController(dependencies.onboarding);
  const settings = createSettingsController(dependencies.settings);
  const verification = createVerificationController(dependencies.verification);

  router.get("/onboarding/status", user, onboarding.getStatus);
  router.post("/onboarding/consent", user, onboarding.saveConsent);
  router.post("/onboarding/profile", user, onboarding.saveProfile);
  router.post("/onboarding/setup", user, onboarding.saveSetup);
  router.post("/onboarding/complete", user, onboarding.completeOnboarding);
  router.get("/settings", user, settings.get);
  router.patch("/settings/profile", user, settings.updateProfile);
  router.patch("/settings/privacy", user, settings.updatePrivacy);
  router.patch("/settings/notifications", user, settings.updateNotifications);
  router.post("/settings/trusted-contacts", user, settings.createContact);
  router.patch("/settings/trusted-contacts/:contactId", user, settings.updateContact);
  router.delete("/settings/trusted-contacts/:contactId", user, settings.removeContact);
  router.post("/settings/data-exports", user, settings.requestExport);
  router.post("/settings/account-deletion", user, settings.requestDeletion);
  router.patch("/settings/account-deletion/:requestId/cancel", user, settings.cancelDeletion);
  router.get("/verification", user, verification.status);
  router.put("/verification/application", user, verification.saveApplication);
  router.put("/verification/documents/:kind", user, express.raw({ type: ["image/jpeg", "image/png", "application/pdf"], limit: "8mb" }), verification.uploadDocument);
  router.post("/verification/submit", user, verification.submit);
  router.get("/admin/verifications", user, verification.adminList);
  router.get("/admin/verifications/:verificationId", user, verification.adminDetail);
  router.post("/admin/verifications/:verificationId/claim", user, verification.adminClaim);
  router.post("/admin/verifications/:verificationId/decision", user, verification.adminDecision);

  router.get("/internal/verification", internal, user, asyncRoute(async (req, res) => {
    await dependencies.verification.assertAiAccess(req.auth!.id);
    sendData(res, { approved: true }, req.requestId);
  }));
  router.post("/internal/notifications", internal, asyncRoute(async (req, res) => {
    const parsed = z.object({ userId: z.string().uuid(), notificationType: z.string().min(1).max(80), title: z.string().min(1).max(200), message: z.string().min(1).max(1000), resourceType: z.string().max(80).optional(), resourceId: z.string().uuid().optional() }).safeParse(req.body);
    if (!parsed.success) throw new ServiceError(400, "VALIDATION_ERROR", "The notification is invalid.");
    const value = parsed.data;
    const { data, error } = await dependencies.database.from("notifications").insert({ user_id: value.userId, notification_type: value.notificationType, title: value.title, message: value.message, resource_type: value.resourceType, resource_id: value.resourceId }).select("*").single();
    if (error || !data) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The notification could not be saved.");
    sendData(res, data, req.requestId, 201);
  }));
  router.post("/internal/audit-events", internal, asyncRoute(async (req, res) => {
    const parsed = z.object({ userId: z.string().uuid().nullable().optional(), eventType: z.string().min(1).max(120), resourceType: z.string().max(80).optional(), resourceId: z.string().uuid().optional(), metadata: z.record(z.string(), z.unknown()).default({}) }).safeParse(req.body);
    if (!parsed.success) throw new ServiceError(400, "VALIDATION_ERROR", "The audit event is invalid.");
    const value = parsed.data;
    const { error } = await dependencies.database.from("audit_events").insert({ user_id: value.userId, event_type: value.eventType, resource_type: value.resourceType, resource_id: value.resourceId, metadata: value.metadata });
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The audit event could not be recorded.");
    sendData(res, { recorded: true }, req.requestId, 201);
  }));
  return createServiceApp({ name: "user-service", router, allowedOrigin: options.allowedOrigin, bodyLimit: "9mb" });
}
