export function callbackFailureKind(
  error: unknown,
  search: string,
): 'browser' | 'cancelled' | 'expired' | 'organization' | 'unknown' {
  const params = new URLSearchParams(search);
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : params.get('error_code');
  const microsoftCode = [code, params.get('error_description')]
    .filter((value): value is string => Boolean(value))
    .find((value) => /\bAADSTS(?:65004|900941)\b/.test(value));
  if (code === 'pkce_code_verifier_not_found' || code === 'bad_code_verifier') return 'browser';
  if (microsoftCode) return 'organization';
  if (params.get('error') === 'access_denied') return 'cancelled';
  if (code === 'flow_state_expired' || code === 'flow_state_not_found') return 'expired';
  return 'unknown';
}
