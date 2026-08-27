import type { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { id: string };
    }
  }
}

export class ServiceError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  constructor(statusCode: number, code: string, message: string, details?: unknown);
}
export function env(name: string, fallback?: string): string;
export function positiveIntegerEnv(name: string, fallback: number): number;
export function secretEnv(name: string, minimumLength?: number): string;
export interface OwnedDatabase {
  from(table: string): ReturnType<SupabaseClient["from"]>;
  storage: SupabaseClient["storage"];
}
export function createOwnedDatabase(options: { url: string; key: string; tables: readonly string[] }): OwnedDatabase;
export function signUserContext(options: { requestId: string; userId: string; timestamp: string; secret: string }): string;
export function gatewayUserHeaders(options: { requestId: string; userId: string; secret: string }): Record<string, string>;
export function requireGatewayUser(secret: string, maxAgeMs?: number): RequestHandler;
export function requireInternalToken(secret: string): RequestHandler;
export function createInternalClient(options: { baseUrl: string; token: string; timeoutMs: number; serviceName: string }): (path: string, options?: { method?: string; headers?: HeadersInit; body?: unknown }) => Promise<any>;
export function sendData(response: Response, data: unknown, requestId: string, statusCode?: number): void;
export function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => unknown | Promise<unknown>): RequestHandler;
export function createServiceApp(options: { name: string; router: Router; allowedOrigin?: string; bodyLimit?: string }): Express;
export function listen(app: Express, options: { name: string; port: number }): import("node:http").Server;
