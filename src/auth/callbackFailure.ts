export function callbackFailureKind(
  error: unknown,
  search: string,
): 'browser' | 'cancelled' | 'expired' | 'identity-conflict' | 'unknown' {
  const params = new URLSearchParams(search);
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : params.get('error_code');
  if (code === 'pkce_code_verifier_not_found' || code === 'bad_code_verifier') return 'browser';
  if (params.get('error') === 'access_denied') return 'cancelled';
  if (code === 'flow_state_expired' || code === 'flow_state_not_found') return 'expired';
  if (code === 'identity_already_exists') return 'identity-conflict';
  return 'unknown';
}
