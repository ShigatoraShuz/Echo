import type { Response } from "express";
import type { ApiSuccess } from "../types/api-response.js";

export function sendSuccess<T>(response: Response, data: T, statusCode = 200): Response<ApiSuccess<T>> {
  return response.status(statusCode).json({
    success: true,
    data,
    meta: { requestId: response.req.requestId },
  });
}
