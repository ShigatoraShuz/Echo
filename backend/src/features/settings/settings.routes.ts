import express, { Router } from "express";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { createSettingsController } from "./settings.controller.js";
import type { SettingsService } from "./settings.service.js";

export function createSettingsRouter(service: SettingsService, verifier: AccessTokenVerifier): Router {
  const controller = createSettingsController(service);
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);
  router.get("/settings", authenticate, controller.get);
  router.patch("/settings/profile", authenticate, controller.updateProfile);
  router.put(
    "/settings/profile/avatar",
    authenticate,
    express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/gif"], limit: "6mb" }),
    controller.uploadAvatar,
  );
  router.patch("/settings/privacy", authenticate, controller.updatePrivacy);
  router.patch("/settings/notifications", authenticate, controller.updateNotifications);
  router.post("/settings/trusted-contacts", authenticate, controller.createContact);
  router.patch("/settings/trusted-contacts/:contactId", authenticate, controller.updateContact);
  router.delete("/settings/trusted-contacts/:contactId", authenticate, controller.removeContact);
  router.post("/settings/data-exports", authenticate, controller.requestExport);
  router.post("/settings/account-deletion", authenticate, controller.requestDeletion);
  router.patch("/settings/account-deletion/:requestId/cancel", authenticate, controller.cancelDeletion);
  router.patch("/settings/security/password", authenticate, controller.changePassword);
  router.get("/settings/security/audit-events", authenticate, controller.listSecurityAuditEvents);
  router.post("/settings/security/sign-out-all-devices", authenticate, controller.signOutAllDevices);
  return router;
}
