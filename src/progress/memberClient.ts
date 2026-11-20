import type { AuthStore } from '../auth/AuthStore';
import { createProgressApi } from './api';
import type { ProgressConfiguration } from './coordinatorTypes';
import type { ProgressOwner } from './types';

export function createMemberClient(
  authStore: AuthStore,
  configuration: ProgressConfiguration | null,
  owner: Extract<ProgressOwner, { kind: 'member' }>,
  isCurrent: () => boolean,
) {
  if (!configuration || !authStore.service) throw new Error('Member progress requires authentication.');
  return createProgressApi(
    configuration,
    () =>
      authStore.service?.getAccessToken(owner.userId) ?? Promise.reject(new Error('Auth unavailable.')),
    isCurrent,
  );
}
