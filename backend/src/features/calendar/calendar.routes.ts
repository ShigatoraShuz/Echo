import { Router, type Request } from "express";
import { z } from "zod";
import type { AccessTokenVerifier } from "../../shared/middleware/auth.middleware.js";
import { createAuthMiddleware } from "../../shared/middleware/auth.middleware.js";
import { endpointLimiter } from "../../shared/middleware/security-policy.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/utils/response.js";
import type { CalendarService } from "./calendar.service.js";

const itemSchema = z.strictObject({
  scheduledOn: z.iso.date(),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  kind: z.enum(["reminder", "note"]),
  content: z.string().trim().min(1).max(500),
});
const updateSchema = itemSchema.extend({ completed: z.boolean() });
const idSchema = z.uuid();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError({ fields: result.error.issues.map((issue) => issue.message) });
  return result.data;
}

function userId(request: Request): string {
  if (!request.auth) throw new ValidationError({ authentication: ["Authentication is required."] });
  return request.auth.id;
}

export function createCalendarRouter(service: CalendarService, verifier: AccessTokenVerifier): Router {
  const router = Router();
  router.use("/calendar/items", createAuthMiddleware(verifier));
  const writeLimiter = endpointLimiter(60);
  router.get("/calendar/items", async (request, response) => {
    const { from, to } = parse(z.object({ from: z.iso.date(), to: z.iso.date() }), request.query);
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0 || days > 62) throw new ValidationError({ range: ["Choose a range of up to 63 days."] });
    sendSuccess(response, await service.list(userId(request), from, to));
  });
  router.post("/calendar/items", writeLimiter, async (request, response) => {
    sendSuccess(response, await service.create(userId(request), parse(itemSchema, request.body)), 201);
  });
  router.put("/calendar/items/:id", writeLimiter, async (request, response) => {
    sendSuccess(
      response,
      await service.update(userId(request), parse(idSchema, request.params.id), parse(updateSchema, request.body)),
    );
  });
  router.delete("/calendar/items/:id", writeLimiter, async (request, response) => {
    sendSuccess(response, await service.remove(userId(request), parse(idSchema, request.params.id)));
  });
  return router;
}
