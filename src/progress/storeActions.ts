import { profileKey } from '../assessment';
import { historyKey } from '../history';
import { parseStoredAttempts } from './attemptCodec';
import { isGenerationConflict } from './errors';
import { emptyProfile, parseStoredProfile } from './profileCodec';
import type { StoreActionDependencies } from './storeActionTypes';
import { resetGuestProgress } from './storeGuestExams';
import {
  memberAttemptSnapshot,
  mergeMemberAttempts,
  recoverMemberAttempt,
  retryMemberPending,
} from './storeMemberAttempts';
import { initializeMemberGeneration } from './storeMemberInitialization';
import type * as StoreTypes from './storeTypes';

export function createStoreActions(
  input: StoreTypes.ProgressStoreInput,
  {
    failed,
    getSnapshot,
    getSnapshotVersion,
    guest,
    loading,
    member,
    queue,
    ready,
    setGeneration,
  }: StoreActionDependencies,
): StoreTypes.ProgressStoreActions {
  async function initialize() {
    const preserveReady = getSnapshot().state === 'ready';
    loading();
    const version = getSnapshotVersion();
    try {
      if (input.owner.kind === 'guest') {
        if (!guest) throw new Error('A guest progress store is required.');
        const stored = parseStoredAttempts(guest.read(historyKey));
        if (getSnapshotVersion() !== version) return getSnapshot();
        ready({
          attempts: stored.attempts,
          corruptRows: stored.corruptRows,
          profile: parseStoredProfile(guest.read(profileKey)),
          profileRevision: 0,
        });
      } else {
        if (!member) throw new Error('A member progress client is required.');
        await initializeMemberGeneration(member, setGeneration);
        const [events, profile] = await Promise.all([member.loadAttempts(), member.loadProfile()]);
        if (getSnapshotVersion() !== version) return getSnapshot();
        ready({
          attempts: events,
          corruptRows: 0,
          profile: profile.profile,
          profileRevision: profile.revision,
        });
        if (queue?.hasPending()) failed('save');
      }
    } catch {
      if (getSnapshotVersion() === version) failed('load', preserveReady);
    }
    return getSnapshot();
  }
  return {
    initialize,
    async appendAttempt(certificationId, attempt, prepare) {
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
          return attempt;
        }
        if (!member || !queue) throw new Error('A member progress client is required.');
        const result = await queue.append(
          member,
          certificationId,
          attempt,
          (flushed) => prepare?.(mergeMemberAttempts(snapshot.attempts, flushed)) ?? attempt,
        );
        ready(memberAttemptSnapshot(getSnapshot(), result.flushed));
        return result.attempt;
      } catch (error) {
        await recoverMemberAttempt(input, error, queue, member, getSnapshot, ready, failed);
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
          resetGuestProgress(guest);
        } else if (member) await setGeneration(await member.reset());
        else throw new Error('A member progress client is required.');
        ready({ attempts: [], corruptRows: 0, profile: emptyProfile(), profileRevision: 0 });
      } catch (error) {
        failed('reset');
        throw error;
      }
    },
    async retryPending() {
      if (input.owner.kind === 'guest') await initialize();
      else await retryMemberPending(member, queue, initialize, input, getSnapshot, ready, failed);
    },
  };
}
