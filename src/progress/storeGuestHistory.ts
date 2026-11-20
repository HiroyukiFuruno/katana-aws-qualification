import type { Attempt } from '../attempts';
import { historyKey } from '../history';
import { parseStoredAttempts } from './attemptCodec';
import type { GuestProgressRepository } from './guest';

type HistoryUpdate<T> = { attempts: Attempt[]; value: T };

export function updateGuestHistory<T>(
  guest: GuestProgressRepository,
  update: (attempts: Attempt[]) => HistoryUpdate<T>,
) {
  // 呼び出し側は history lock を保持しており、ここでは再取得しない。
  const existing = parseStoredAttempts(guest.read(historyKey));
  if (existing.corruptRows > 0) throw new Error('Guest history was not saved.');
  const next = update(existing.attempts);
  if (next.attempts === existing.attempts) return { attempts: existing.attempts, value: next.value };
  if (guest.write(historyKey, JSON.stringify(next.attempts)) === 'failed') {
    throw new Error('Guest history was not saved.');
  }
  const stored = parseStoredAttempts(guest.read(historyKey));
  if (stored.corruptRows > 0) throw new Error('Guest history was not saved.');
  return { attempts: stored.attempts, value: next.value };
}
