import { Router } from "express";
import { z } from "zod";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { requireUuidParam } from "../../shared/utils/uuid-param.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { NotificationService } from "./notifications.service.js";

const listQuerySchema = z.object({
  status: z.enum(["all", "unread"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function userId(request: { auth?: { id: string } }): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createNotificationsRouter(service: NotificationService, verifier: AccessTokenVerifier): Router {
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

  return router;
}
