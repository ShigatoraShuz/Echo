/** Browser traffic uses the private HTTPS gateway; internal services stay on loopback. */
export function privateGatewayEnvironment(value) {
  if (!value) return {};
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.ts.net') || url.port ||
      url.username || url.password || url.search || url.hash ||
      !['/api/v1', '/api/v1/'].includes(url.pathname)) {
    throw Error('ECHO_REMOTE_API_BASE_URL must be the private Tailscale HTTPS /api/v1 address.');
  }
  return {
    FRONTEND_URL: url.origin,
    NEXT_PUBLIC_API_BASE_URL: `${url.origin}/api/v1`,
    TRUSTED_PROXY_ADDRESSES: '127.0.0.1,::1',
  };
}
