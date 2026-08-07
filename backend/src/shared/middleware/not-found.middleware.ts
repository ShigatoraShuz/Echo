import type { Request, Response } from "express";

export function notFoundMiddleware(request: Request, response: Response): void {
  response.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `No route matches ${request.method} ${request.path}.` },
    meta: { requestId: request.requestId },
  });
}
