/** One request owns its timeout/listener and must dispose them when it settles. */
export function createRequestSignal(externalSignal: AbortSignal | undefined | null, timeoutMs: number, required = false) {
  if (!required && !externalSignal && !(timeoutMs > 0 && timeoutMs < Infinity)) {
    return { signal: undefined, dispose: () => {}, abort: () => {} };
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  const dispose = () => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
    externalSignal?.removeEventListener("abort", onExternalAbort);
    controller.signal.removeEventListener("abort", dispose);
  };
  controller.signal.addEventListener("abort", dispose, { once: true });
  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  } else {
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    if (timeoutMs > 0 && timeoutMs < Infinity) {
      timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
    }
  }
  return { signal: controller.signal, dispose, abort: (reason?: unknown) => controller.abort(reason) };
}

/** Compatibility for callers that only need an aborting signal. Prefer the disposable scope. */
export function composeSignal(externalSignal: AbortSignal | undefined | null, timeoutMs: number): AbortSignal | undefined {
  return createRequestSignal(externalSignal, timeoutMs).signal;
}
