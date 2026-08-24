import type { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "../request-context.js";

export function requestContextMiddleware(request: Request, _response: Response, next: NextFunction): void {
  runWithRequestContext({ requestId: request.requestId }, next);
}
