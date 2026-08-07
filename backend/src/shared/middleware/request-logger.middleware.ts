import type { NextFunction, Request, Response } from "express";

export function requestLoggerMiddleware(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();

  response.on("finish", () => {
    console.info(JSON.stringify({
      requestId: request.requestId,
      service: "backend",
      route: request.route?.path ?? request.path,
      method: request.method,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
      userIdHash: request.auth?.id ? "present" : undefined,
    }));
  });

  next();
}
