import { profileKey } from '../assessment';
import { withHistoryLock } from '../historyLock';
import { historyKey } from '../learningStorage';
import { parseStoredAttempts } from './attemptCodec';
import type { GuestProgressRepository } from './guest';
import { parseStoredProfile } from './profileCodec';

export async function loadGuestProgress(guest: GuestProgressRepository) {
  return withHistoryLock(() => {
    const attempts = parseStoredAttempts(guest.read(historyKey));
    const profile = parseStoredProfile(guest.read(profileKey));
    const flushed = guest.flushPending();
    if (flushed === 'failed' || flushed === 'conflict') {
      throw new Error('Guest progress was not saved.');
    }
    return { attempts, profile };
  });
}
