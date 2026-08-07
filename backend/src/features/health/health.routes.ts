import { Router } from "express";
import { getHealth, getReadiness } from "./health.controller.js";

export function createHealthRouter(): Router {
  const router = Router();
  router.get("/health", getHealth);
  router.get("/health/ready", getReadiness);
  return router;
}
