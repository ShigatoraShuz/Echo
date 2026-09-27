import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { RequestHandler } from "express";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

const controlsSchema = z.strictObject({ aiEnabled: z.boolean(), uploadsEnabled: z.boolean(), disabledRoutePrefixes: z.array(z.string().regex(/^\/api\/v1\/[a-z0-9/-]+$/)).max(20) });
export type RuntimeControls = z.infer<typeof controlsSchema>;
// An operator atomically replaces this secret-free file on all instances.
// No dynamic module loading, user-controlled filename, or redeploy is needed.
export async function runtimeControls(): Promise<RuntimeControls> {
  const file = process.env.ECHO_SECURITY_CONTROLS_FILE;
  if (!file) return { aiEnabled: true, uploadsEnabled: true, disabledRoutePrefixes: [] };
  try {
    const raw = await readFile(file, "utf8");
    if (raw.length > 8192) throw new Error();
    return controlsSchema.parse(JSON.parse(raw));
  } catch { throw new ExternalServiceError("SECURITY_CONTROLS_UNAVAILABLE", "This feature is temporarily unavailable."); }
}
export async function assertAiEnabled(): Promise<void> {
  if (!(await runtimeControls()).aiEnabled) throw new ExternalServiceError("AI_DISABLED", "AI processing is temporarily unavailable.");
}
export const runtimeControlMiddleware: RequestHandler = async (request, _response, next) => {
  try {
    const controls = await runtimeControls();
    if (controls.disabledRoutePrefixes.some((prefix) => request.path === prefix || request.path.startsWith(prefix + "/")))
      throw new ExternalServiceError("FEATURE_DISABLED", "This feature is temporarily unavailable.");
    if (!controls.uploadsEnabled && request.method === "PUT" && /\/(?:images|documents)\/|\/profile\/avatar$/.test(request.path))
      throw new ExternalServiceError("UPLOADS_DISABLED", "Uploads are temporarily unavailable.");
    if (!controls.aiEnabled && (/\/buddy\/messages$|\/analyze$|\/workers?\//.test(request.path) ||
        (request.method === "POST" && /\/journals$/.test(request.path) && (request.body?.analysisConsent === true || request.body?.analysis_consent === true))))
      throw new ExternalServiceError("AI_DISABLED", "AI processing is temporarily unavailable.");
    next();
  } catch (error) { next(error); }
};
