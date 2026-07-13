import { AppError } from "@/shared/errors/app-error";
import type { AuthTokenProvider } from "@/shared/services/auth-token-provider";
import { nullTokenProvider } from "@/shared/services/auth-token-provider";
import { normalizeError } from "@/shared/errors/normalize-error";
import { composeSignal } from "@/shared/utils/abort-signal";

export interface ApiClientOptions {
  baseUrl: string;
  tokenProvider?: AuthTokenProvider;
  defaultTimeout?: number;
}

export interface RequestOptions {
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

function parseAppErrorResponse(
  body: unknown,
  statusCode: number
): AppError | null {
  if (!body || typeof body !== "object") return null;
  const errBody = body as ApiErrorResponse;
  if (!errBody.error) return null;

  const code = errBody.error.code ?? "UNKNOWN_ERROR";
  const userMessage = errBody.error.message ?? "Something went wrong.";
  const field = errBody.error.field;

  return new AppError({
    code: code as AppError["code"],
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
  const {
    baseUrl,
    tokenProvider = nullTokenProvider,
    defaultTimeout = 30_000,
  } = options;

  async function request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions
  ): Promise<TResponse> {
    const requestId = generateRequestId();
    const url = joinUrl(baseUrl, path);
    const timeoutMs = opts?.timeout ?? defaultTimeout;
    const combinedSignal = composeSignal(opts?.signal, timeoutMs);

    const headers: Record<string, string> = {
      ...opts?.headers,
    };

    const token = await tokenProvider.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
        signal: combinedSignal,
      });

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

      if (!response.ok) {
        const parsedError =
          parseAppErrorResponse(responseBody, response.status) ??
          classifyHttpError(response.status);

        if (!parsedError.requestId) {
          (parsedError as { requestId?: string }).requestId = requestId;
        }

        throw parsedError;
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
    }
  }

  return {
    get<TResponse>(path: string, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("GET", path, undefined, opts);
    },

    post<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      opts?: RequestOptions
    ): Promise<TResponse> {
      return request<TResponse>("POST", path, body, opts);
    },

    patch<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      opts?: RequestOptions
    ): Promise<TResponse> {
      return request<TResponse>("PATCH", path, body, opts);
    },

    put<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      opts?: RequestOptions
    ): Promise<TResponse> {
      return request<TResponse>("PUT", path, body, opts);
    },

    delete<TResponse>(path: string, opts?: RequestOptions): Promise<TResponse> {
      return request<TResponse>("DELETE", path, undefined, opts);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
