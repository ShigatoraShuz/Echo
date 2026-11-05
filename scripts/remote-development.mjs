// Browser-facing remote development settings; internal service URLs stay loopback.
export function remoteDevelopmentEnvironment(value) {
  if (!value) return {};
  const api = new URL(value);
  if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || api.pathname.replace(/\/$/, '') !== '/api/v1')
    throw new Error('ECHO_REMOTE_API_BASE_URL must be an HTTPS origin followed by /api/v1, without credentials, query, or fragment.');
  return {
    NEXT_PUBLIC_API_BASE_URL: api.href.replace(/\/$/, ''),
    FRONTEND_URL: api.origin,
    TRUSTED_PROXY_ADDRESSES: '127.0.0.1,::1',
  };
}
