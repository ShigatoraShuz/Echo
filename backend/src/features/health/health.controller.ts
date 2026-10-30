import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";

export function getHealth(_request: Request, response: Response): void {
  sendSuccess(response, { status: "ok", service: "backend" });
}

export async function getReadiness(request: Request, response: Response): Promise<void> {
  const check = request.app.locals.checkReadiness as (() => Promise<boolean>) | undefined;
  let ready = false;
  try { ready = check ? await check() : process.env.NODE_ENV === "test"; } catch { /* Dependency details remain private. */ }
  response.status(ready ? 200 : 503);
  sendSuccess(response, { status: ready ? "ready" : "not_ready", service: "backend", ...(request.app.locals.readinessComponents?{components:request.app.locals.readinessComponents}:{}) });
}
