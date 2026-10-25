/** Local interactive demonstrations must not run unrelated shared-data maintenance. */
export function httpOnlyMode(nodeEnv: string, flag: string | undefined): boolean {
  if (flag !== undefined && flag !== '0' && flag !== '1') throw new Error('ECHO_HTTP_ONLY_MODE must be 0 or 1.');
  if (flag === '1' && nodeEnv !== 'development') throw new Error('HTTP-only mode is restricted to local development.');
  return flag === '1';
}
