import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";

export function getHealth(_request: Request, response: Response): void {
  sendSuccess(response, { status: "ok", service: "backend" });
}

export function getReadiness(_request: Request, response: Response): void {
  sendSuccess(response, { status: "ready", service: "backend" });
}
