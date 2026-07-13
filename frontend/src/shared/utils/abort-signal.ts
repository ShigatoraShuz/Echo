export function composeSignal(
  externalSignal: AbortSignal | undefined | null,
  timeoutMs: number
): AbortSignal | undefined {
  const controller = new AbortController();
  const signal = controller.signal;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cleanup: (() => void) | undefined;

  const onAbort = () => {
    if (externalSignal) {
      controller.abort(externalSignal.reason);
    } else {
      controller.abort(new DOMException("Timeout", "TimeoutError"));
    }
  };

  if (timeoutMs > 0 && timeoutMs < Infinity) {
    timeoutId = setTimeout(onAbort, timeoutMs);
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onExternalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      cleanup = () => externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (!externalSignal && !timeoutId) {
    return undefined;
  }

  const originalFetch = signal.addEventListener.bind(signal);
  signal.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    originalFetch(type, listener, options);
  } as typeof signal.addEventListener;

  signal.addEventListener("abort", () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (cleanup) cleanup();
  }, { once: true });

  return signal;
}
