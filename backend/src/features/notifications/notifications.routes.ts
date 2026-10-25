import { Router } from "express";
import { z } from "zod";
import { notificationCursorSchema } from "@echo/contracts";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import type { NotificationService } from "./notifications.service.js";
import type { PushSubscriptionsService } from "./push-subscriptions.service.js";

const listQuerySchema = z.object({
  status: z.enum(["all", "unread"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(["all", "general", "appointments"]).optional(),
  before: notificationCursorSchema.optional(),
});
const subscriptionSchema = z.strictObject({
  endpoint: z.url().max(2_048),
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
});

function userId(request: { auth?: { id: string } }): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createNotificationsRouter(service: NotificationService, verifier: AccessTokenVerifier,
  pushSubscriptions?: PushSubscriptionsService): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(verifier);

  router.get("/notifications", authenticate, async (request, response) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError({
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "query",
          message: issue.message,
        })),
      });
    }
    sendSuccess(response, await service.list(userId(request), parsed.data));
  });

  router.patch("/notifications/read-all", authenticate, async (request, response) => {
    sendSuccess(response, await service.markAllRead(userId(request)));
  });

  router.patch("/notifications/:notificationId/read", authenticate, async (request, response) => {
    sendSuccess(response, await service.markRead(userId(request), requireUuidParam(request, "notificationId")));
  });

  router.post("/notifications/push/subscriptions", authenticate, endpointLimiter(10), async (request, response) => {
    if (!pushSubscriptions) throw new ExternalServiceError("PUSH_UNAVAILABLE", "Device alerts are not configured yet.");
    const parsed = subscriptionSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError({ subscription: ["Provide a valid device subscription."] });
    sendSuccess(response, await pushSubscriptions.save(userId(request), parsed.data));
  });

  router.post("/notifications/push/unsubscribe", authenticate, endpointLimiter(10), async (request, response) => {
    if (!pushSubscriptions) throw new ExternalServiceError("PUSH_UNAVAILABLE", "Device alerts are not configured yet.");
    const parsed = z.strictObject({ endpoint: z.url().max(2_048) }).safeParse(request.body);
    if (!parsed.success) throw new ValidationError({ endpoint: ["Provide a valid device endpoint."] });
    sendSuccess(response, await pushSubscriptions.remove(userId(request), parsed.data.endpoint));
  });

  return router;
}
