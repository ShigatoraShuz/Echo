const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);

export interface ResilientFetchOptions {
  baseDelayMs?: number;
  maxAttempts?: number;
  logger?: Pick<Console, "warn">;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === "object" && "method" in input) return input.method.toUpperCase();
  return "GET";
}

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("The operation was aborted."));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("The operation was aborted."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createResilientFetch(options: ResilientFetchOptions = {}): typeof fetch {
  const baseDelayMs = options.baseDelayMs ?? 150;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const logger = options.logger ?? console;

  return async function resilientFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (!RETRYABLE_METHODS.has(getRequestMethod(input, init))) {
      return fetch(input, init);
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        await delay(baseDelayMs * 2 ** (attempt - 2), init?.signal);
      }
      try {
        const response = await fetch(input, init);
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts) {
          return response;
        }
        await response.body?.cancel().catch(() => undefined);
      } catch (error) {
        if (init?.signal?.aborted) throw error;
        lastError = error;
      }
      if (attempt < maxAttempts) {
        logger.warn(
          JSON.stringify({
            service: "backend",
            event: "supabase_request_retry",
            attempt,
            nextDelayMs: baseDelayMs * 2 ** (attempt - 1),
          }),
        );
      }
    }

    throw lastError;
  };
}
