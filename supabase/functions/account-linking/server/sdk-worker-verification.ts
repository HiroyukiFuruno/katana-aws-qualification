import type { Session } from '@supabase/auth-js';
import type { ServerSdkClient, ServerSdkLeg } from './sdk-worker.types.ts';

type Verification = 'verified' | 'invalid' | 'unavailable';

export function indeterminateAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { name?: unknown; status?: unknown };
  return (
    value.name === 'AuthRetryableFetchError' ||
    (typeof value.status === 'number' &&
      (value.status >= 500 || value.status === 408 || value.status === 429))
  );
}

export async function verifySession(
  auth: ServerSdkClient,
  leg: ServerSdkLeg,
  session: Session,
): Promise<Verification> {
  if (!session.access_token || !session.user?.id || (leg.side === 'source' && !leg.expectedAuthUid))
    return 'invalid';
  try {
    const verified = await auth.getUser(session.access_token);
    if (verified.error) return indeterminateAuthError(verified.error) ? 'unavailable' : 'invalid';
    return verified.data.user?.id === session.user.id &&
      (!leg.expectedAuthUid || verified.data.user.id === leg.expectedAuthUid)
      ? 'verified'
      : 'invalid';
  } catch {
    // 照会できないことを本人不一致と扱わず、保存済みreceiptを次回の検証に残す。
    return 'unavailable';
  }
}
