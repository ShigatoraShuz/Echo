/** Transport-only check: never loads weights or submits user content. */
export async function checkCoreTransport(origin, token, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(new URL('/v2/preparation', origin), {
      headers: { Authorization: 'Bearer ' + token }, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw Error('AI_TRANSPORT_CONNECTION_FAILED: private AI service could not be reached.');
  }
  if ([401, 403].includes(response.status)) throw Error('AI_TRANSPORT_AUTH_FAILED: backend and AI service credentials do not match. Restart one coordinated stack.');
  if (response.status === 429) throw Error('AI_TRANSPORT_RATE_LIMITED: private AI status requests are throttled.');
  if (!response.ok) throw Error('AI_TRANSPORT_UNAVAILABLE: authenticated AI transport is not ready.');
  // The protected status route is fast even while weights load.
  try {
    const value = await response.json();
    if (!value || !Object.hasOwn(value, 'preparation')) throw Error();
  } catch { throw Error('AI_TRANSPORT_INVALID_RESPONSE: private AI status response is invalid.'); }
}
