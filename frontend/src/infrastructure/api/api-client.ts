import { AppError } from "@/shared/errors/app-error";
import type { AuthTokenProvider } from "@/infrastructure/api/auth-token-provider";
import { nullTokenProvider } from "@/infrastructure/api/auth-token-provider";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createRequestSignal } from "@/shared/utils/abort-signal";
import { invalidateNavigationReads, navigationReadGeneration, readNavigationData } from "./navigation-read-cache";

export interface ApiClientOptions {
  baseUrl: string;
  tokenProvider?: AuthTokenProvider;
  defaultTimeout?: number;
}

export interface RequestOptions {
  /** Opt-in for display data; authorization, consent, and safety checks stay live. */
  navigationCache?: boolean;
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    field?: string;
    detail?: string;
  };
}

interface EnvelopeLike {
  success?: unknown;
  error?: unknown;
}

function isEnvelopeWithFailure(body: unknown): body is ApiErrorResponse & { success: false } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as EnvelopeLike).success === false &&
    typeof (body as ApiErrorResponse).error === "object"
  );
}

function isMalformedEnvelope(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as EnvelopeLike).success !== undefined &&
    (body as EnvelopeLike).success !== true
  );
}

let requestCounter = 0;

function generateRequestId(): string {
  requestCounter += 1;
  return `req_${Date.now()}_${requestCounter}`;
}

function joinUrl(base: string, path: string): string {
  const baseClean = base.replace(/\/+$/, "");
  const pathClean = path.replace(/^\/+/, "");
  return `${baseClean}/${pathClean}`;
}

function parseAppErrorResponse(body: unknown, statusCode: number): AppError | null {
  if (!body || typeof body !== "object") return null;
  const errBody = body as ApiErrorResponse;
  if (!errBody.error) return null;

  const code = errBody.error.code ?? "UNKNOWN_ERROR";
  const normalizedCode = statusCode === 401 && code === "UNKNOWN_ERROR" ? "AUTHENTICATION_ERROR" : code;
  const userMessage = errBody.error.message ?? "Something went wrong.";
  const field = errBody.error.field;

  return new AppError({
    code: normalizedCode as AppError["code"],
    userMessage,
    developerMessage: errBody.error.detail,
    statusCode,
    fieldErrors: field ? [{ field, message: userMessage }] : undefined,
    retryable: statusCode >= 500 || statusCode === 429,
  });
}

function classifyHttpError(statusCode: number): AppError {
  switch (statusCode) {
    case 400:
      return new AppError({
        code: "VALIDATION_ERROR",
        userMessage: "Please check your input and try again.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: false,
      });
    case 401:
      return new AppError({
        code: "AUTHENTICATION_ERROR",
        userMessage: "Your session has expired. Please log in again.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: true,
      });
    case 403:
      return new AppError({
        code: "AUTHORIZATION_ERROR",
        userMessage: "You do not have permission to perform this action.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: false,
      });
    case 404:
      return new AppError({
        code: "NOT_FOUND",
        userMessage: "The requested resource was not found.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: false,
      });
    case 409:
      return new AppError({
        code: "CONFLICT",
        userMessage: "This item was updated by another session.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: false,
      });
    case 429:
      return new AppError({
        code: "RATE_LIMITED",
        userMessage: "Too many requests. Please wait a moment.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: true,
      });
    default:
      return new AppError({
        code: statusCode >= 500 ? "SERVER_ERROR" : "UNKNOWN_ERROR",
        userMessage:
          statusCode >= 500
            ? "Something went wrong on our end. Please try again later."
            : "Something unexpected happened.",
        developerMessage: `HTTP ${statusCode}`,
        statusCode,
        retryable: statusCode >= 500,
      });
  }
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, tokenProvider = nullTokenProvider, defaultTimeout = 30_000 } = options;
  let refreshInFlight: Promise<string | null> | null = null;

  async function request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<TResponse> {
    const requestId = generateRequestId();
    if (method !== "GET") {
      invalidateNavigationReads();
      return requestWithRetry<TResponse>(requestId, method, path, body, opts, false).finally(invalidateNavigationReads);
    }
    if (
      opts?.navigationCache &&
      !opts.signal &&
      !opts.headers &&
      /^\/(?:dashboard(?:\/insights)?|settings\/profile|support-resources)(?:\?|$)/.test(path)
    ) {
      const generation = navigationReadGeneration();
      const token = await tokenProvider.getAccessToken();
      if (generation !== navigationReadGeneration()) throw new DOMException("Session or data changed", "AbortError");
      return readNavigationData(`${joinUrl(baseUrl, path)}:${token ?? "guest"}`, () =>
        requestWithRetry<TResponse>(requestId, method, path, body, opts, false, token),
      );
    }
    return requestWithRetry<TResponse>(requestId, method, path, body, opts, false);
  }

  async function requestWithRetry<TResponse>(
    requestId: string,
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
    retried = false,
    accessToken?: string | null,
  ): Promise<TResponse> {
    const url = joinUrl(baseUrl, path);
    const timeoutMs = opts?.timeout ?? defaultTimeout;
    const { signal: combinedSignal, dispose, abort } = createRequestSignal(opts?.signal, timeoutMs, true);
    const invalidate = () => abort(new DOMException("Session changed", "AbortError"));
    if (typeof window !== "undefined")
      window.addEventListener("echo:sensitive-state-cleared", invalidate, { once: true });

    const headers: Record<string, string> = {
      "X-Request-Id": requestId,
      ...opts?.headers,
    };

    if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
    }

    try {
      combinedSignal?.throwIfAborted();
      const token = accessToken === undefined ? await tokenProvider.getAccessToken() : accessToken;
      combinedSignal?.throwIfAborted();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(url, {
        method,
        headers,
        body:
          body !== undefined
            ? body instanceof FormData || body instanceof Blob
              ? body
              : JSON.stringify(body)
            : undefined,
        signal: combinedSignal,
      });
      if (response.status === 401 || response.status === 403) invalidateNavigationReads();
      combinedSignal?.throwIfAborted();

      if (response.status === 204) {
        return undefined as TResponse;
      }

      let responseBody: unknown;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      } else if (contentType.includes("text/")) {
        responseBody = await response.text();
      } else {
        const blob = await response.blob();
        responseBody = blob;
      }
      combinedSignal?.throwIfAborted();

      if (!response.ok) {
        if (response.status === 401 && !retried) {
          combinedSignal?.throwIfAborted();
          const refreshedToken = await (refreshInFlight ??= tokenProvider.refreshAccessToken().finally(() => {
            refreshInFlight = null;
          }));
          combinedSignal?.throwIfAborted();
          if (refreshedToken) {
            return requestWithRetry<TResponse>(requestId, method, path, body, opts, true, refreshedToken);
          }
          await tokenProvider.clearSession();
        } else if (response.status === 401) {
          // A refreshed token can also be revoked. Fail closed rather than
          // leaving mounted private state behind after the bounded retry.
          await tokenProvider.clearSession();
        }

        const parsedError = parseAppErrorResponse(responseBody, response.status) ?? classifyHttpError(response.status);

        if (!parsedError.requestId) {
          (parsedError as { requestId?: string }).requestId = requestId;
        }

        throw parsedError;
      }

      const failedEnvelope = isEnvelopeWithFailure(responseBody);
      if (failedEnvelope) {
        const parsedError =
          parseAppErrorResponse(responseBody, response.status) ??
          new AppError({
            code: "CONTRACT_ERROR",
            userMessage: "Something went wrong. Please try again later.",
            developerMessage: "Server returned success:false on a 2xx status.",
            statusCode: response.status,
            retryable: false,
          });
        if (!parsedError.requestId) {
          (parsedError as { requestId?: string }).requestId = requestId;
        }
        throw parsedError;
      }

      if (isMalformedEnvelope(responseBody)) {
        throw new AppError({
          code: "CONTRACT_ERROR",
          userMessage: "Something went wrong. Please try again later.",
          developerMessage: "Response envelope is malformed (success flag is neither true nor false).",
          statusCode: response.status,
          retryable: false,
        });
      }

      return responseBody as TResponse;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const normalized = normalizeError(error);
      if (!normalized.requestId) {
        (normalized as { requestId?: string }).requestId = requestId;
      }
      throw normalized;
    } finally {
      dispose();
      if (typeof window !== "undefined") window.removeEventListener("echo:sensitive-state-cleared", invalidate);
    }
  }

  return {
    get<TResponse>(path: string, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("GET", path, undefined, opts);
    },

    post<TResponse, TBody = unknown>(path: string, body?: TBody, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("POST", path, body, opts);
    },

    patch<TResponse, TBody = unknown>(path: string, body?: TBody, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("PATCH", path, body, opts);
    },

    put<TResponse, TBody = unknown>(path: string, body?: TBody, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("PUT", path, body, opts);
    },

    delete<TResponse>(path: string, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("DELETE", path, undefined, opts);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
