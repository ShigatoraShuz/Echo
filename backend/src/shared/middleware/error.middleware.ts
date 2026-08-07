import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { redact } from "../utils/redaction.js";

export const errorMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  const appError = error instanceof AppError
    ? error
    : new AppError({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again later.",
      logLevel: "error",
    });

  console[appError.logLevel](JSON.stringify({
    requestId: request.requestId,
    service: "backend",
    errorCode: appError.code,
    statusCode: appError.statusCode,
    details: redact(appError.details),
  }));

  response.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
    meta: { requestId: request.requestId },
  });
};
