import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header("x-request-id");
  request.requestId = incoming && /^[0-9a-f-]{36}$/i.test(incoming) ? incoming : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}
