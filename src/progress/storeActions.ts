import { profileKey } from '../assessment';
import { historyKey } from '../history';
import { parseStoredAttempts } from './attemptCodec';
import { isGenerationConflict, reconcileAttemptConflict } from './errors';
import type { GuestProgressRepository } from './guest';
import type { MemberProgressRepository } from './member';
import { emptyProfile, parseStoredProfile } from './profileCodec';
import type { MemberRetryQueue } from './retryQueue';
import type { ProgressSnapshot, ProgressStore, ProgressStoreInput } from './storeTypes';
type ReadyData = Pick<ProgressSnapshot, 'attempts' | 'corruptRows' | 'profile' | 'profileRevision'>;
type Dependencies = {
  failed: (error: ProgressSnapshot['error'], preserveReady?: boolean) => void;
  getSnapshot: () => ProgressSnapshot;
  guest?: GuestProgressRepository;
  loading: () => void;
  member?: MemberProgressRepository;
  queue?: MemberRetryQueue;
  ready: (next: ReadyData) => void;
  setGeneration: (generation: number) => void;
};
export function createStoreActions(
  input: ProgressStoreInput,
  { failed, getSnapshot, guest, loading, member, queue, ready, setGeneration }: Dependencies,
): Pick<ProgressStore, 'appendAttempt' | 'initialize' | 'replaceProfile' | 'reset' | 'retryPending'> {
  async function initialize() {
    const preserveReady = getSnapshot().state === 'ready';
    loading();
    try {
      if (input.owner.kind === 'guest') {
        if (!guest) throw new Error('A guest progress store is required.');
        const stored = parseStoredAttempts(guest.read(historyKey));
        ready({
          attempts: stored.attempts,
          corruptRows: stored.corruptRows,
          profile: parseStoredProfile(guest.read(profileKey)),
          profileRevision: 0,
        });
      } else {
        if (!member) throw new Error('A member progress client is required.');
        setGeneration(await member.initialize());
        const [events, profile] = await Promise.all([member.loadAttempts(), member.loadProfile()]);
        ready({
          attempts: events,
          corruptRows: 0,
          profile: profile.profile,
          profileRevision: profile.revision,
        });
      }
    } catch {
      failed('load', preserveReady);
    }
    return getSnapshot();
  }
  const recoverAttempt = (error: unknown) =>
    (member && queue ? reconcileAttemptConflict(input, error, queue, member) : Promise.resolve())
      .catch(() => undefined)
      .finally(() => failed('save'));
  return {
    initialize,
    async appendAttempt(certificationId, attempt) {
      try {
        const snapshot = getSnapshot();
        if (input.owner.kind === 'guest') {
          if (!guest) throw new Error('A guest progress store is required.');
          const attempts = [...snapshot.attempts, attempt];
          if (guest.write(historyKey, JSON.stringify(attempts)) === 'failed') {
            throw new Error('Guest history was not saved.');
          }
          const stored = parseStoredAttempts(guest.read(historyKey));
          ready({
            attempts: stored.attempts,
            corruptRows: stored.corruptRows,
            profile: snapshot.profile,
            profileRevision: snapshot.profileRevision,
          });
          return;
        }
        if (!member || !queue) throw new Error('A member progress client is required.');
        const events = await queue.append(member, certificationId, attempt);
        ready({
          attempts: [...snapshot.attempts, ...events.map((event) => event.attempt)],
          corruptRows: snapshot.corruptRows,
          profile: snapshot.profile,
          profileRevision: snapshot.profileRevision,
        });
      } catch (error) {
        await recoverAttempt(error);
        throw error;
      }
    },
    async replaceProfile(profile) {
      try {
        const snapshot = getSnapshot();
        if (input.owner.kind === 'guest') {
          if (!guest) throw new Error('A guest progress store is required.');
          if (guest.write(profileKey, JSON.stringify(profile)) === 'failed') {
            throw new Error('Guest profile was not saved.');
          }
          ready({
            attempts: snapshot.attempts,
            corruptRows: snapshot.corruptRows,
            profile,
            profileRevision: snapshot.profileRevision,
          });
          return;
        }
        if (!member) throw new Error('A member progress client is required.');
        const revision = await member.replaceProfile(profile, snapshot.profileRevision);
        ready({
          attempts: snapshot.attempts,
          corruptRows: snapshot.corruptRows,
          profile,
          profileRevision: revision,
        });
      } catch (error) {
        try {
          if (!isGenerationConflict(error)) input.onProfileConflict?.();
        } finally {
          failed('save');
        }
        throw error;
      }
    },
    async reset() {
      try {
        if (input.owner.kind === 'guest') {
          if (!guest) throw new Error('A guest progress store is required.');
          guest.remove(historyKey);
          guest.remove(profileKey);
        } else if (member) setGeneration(await member.reset());
        else throw new Error('A member progress client is required.');
        queue?.clear();
        ready({ attempts: [], corruptRows: 0, profile: emptyProfile(), profileRevision: 0 });
      } catch (error) {
        failed('reset');
        throw error;
      }
    },
    async retryPending() {
      try {
        if (member && queue) await queue.flush(member);
        await initialize();
      } catch (error) {
        await recoverAttempt(error);
        throw error;
      }
    },
  };
}
