import { withHistoryLock } from '../historyLock';
import type { GuestProgressRepository } from './guest';
import type { ProgressSnapshot } from './storeTypes';
import { assertCurrentProgressOwner, type ProgressOperation } from './types';

export async function resolveGuestStorageConflict(
  guest: GuestProgressRepository,
  operation: ProgressOperation,
  initialize: () => Promise<ProgressSnapshot>,
  notifyChanged: () => void,
  key: string,
  choice: 'pending' | 'stored',
) {
  assertCurrentProgressOwner(operation);
  const result = await withHistoryLock(() => guest.resolveStorageConflict(key, choice));
  if (result !== 'saved') throw new Error('Guest storage conflict was not resolved.');
  assertCurrentProgressOwner(operation);
  const refreshed = await initialize();
  assertCurrentProgressOwner(operation);
  if (refreshed.error === 'load') throw new Error('Guest progress could not be reloaded.');
  notifyChanged();
}
