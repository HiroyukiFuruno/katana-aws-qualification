import { AuthAdminApi, isAuthApiError, isAuthRetryableFetchError } from '@supabase/auth-js';
import { type AuthDeletion, AuthDeletionUnavailableError } from './types.ts';

type Environment = { authUrl: string; serviceRoleKey: string };
type Fetcher = typeof globalThis.fetch;

function knownAbsence(error: { status?: number; code?: string }) {
  return error.status === 404 && error.code === 'user_not_found';
}
function unavailable(error: { status?: number }) {
  return (
    isAuthRetryableFetchError(error) ||
    (isAuthApiError(error) && (error.status === 429 || error.status >= 500))
  );
}
function reject(error: { status?: number }) {
  if (unavailable(error)) throw new AuthDeletionUnavailableError();
  throw new Error('Auth administration rejected the deletion request.');
}

export class OfficialAuthDeletion implements AuthDeletion {
  private readonly admin: InstanceType<typeof AuthAdminApi>;
  constructor(environment: Environment, fetcher: Fetcher = globalThis.fetch) {
    const origin = new URL(environment.authUrl);
    if (
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      !environment.serviceRoleKey ||
      !['http:', 'https:'].includes(origin.protocol)
    )
      throw new Error('Invalid Auth deletion environment.');
    this.admin = new AuthAdminApi({
      url: new URL('/auth/v1', origin).href,
      headers: {
        apikey: environment.serviceRoleKey,
        Authorization: `Bearer ${environment.serviceRoleKey}`,
      },
      fetch: (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    });
  }
  async remove(userId: string) {
    const { error } = await this.admin.deleteUser(userId, false);
    if (error && !knownAbsence(error)) reject(error);
  }
  async isAbsent(userId: string) {
    const { data, error } = await this.admin.getUserById(userId);
    if (error) {
      if (knownAbsence(error)) return true;
      reject(error);
    }
    if (!data.user || data.user.id !== userId)
      throw new Error('Auth administration returned a mismatched user.');
    return false;
  }
}
