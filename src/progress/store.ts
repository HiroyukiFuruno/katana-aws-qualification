import { createMemberExamRepository } from './examRepository';
import { createGuestProgressRepository } from './guest';
import { createMemberProgressRepository } from './member';
import { MemberRetryQueue } from './retryQueue';
import { createStoreActions } from './storeActions';
import {
  initialProgressSnapshot,
  type ProgressSnapshot,
  type ProgressStore,
  type ProgressStoreInput,
} from './storeTypes';
import type { ProgressOperation } from './types';

export function createProgressStore(input: ProgressStoreInput): ProgressStore {
  let active = true;
  let generation = 0;
  const operation: ProgressOperation = { isCurrent: () => active && input.isCurrent() };
  const guest =
    input.owner.kind === 'guest'
      ? createGuestProgressRepository(input.owner, input.storage, operation)
      : undefined;
  const member =
    input.owner.kind === 'member' && input.client
      ? createMemberProgressRepository(input.owner, input.client, operation)
      : undefined;
  const queue =
    input.owner.kind === 'member' ? new MemberRetryQueue(input.owner, input.storage) : undefined;
  const exams =
    input.owner.kind === 'member' && input.client
      ? createMemberExamRepository(input.client, () => generation, operation.isCurrent)
      : undefined;
  const listeners = new Set<() => void>();
  let snapshot: ProgressSnapshot = initialProgressSnapshot(input.owner);
  const publish = (next: ProgressSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const ready = (
    next: Pick<ProgressSnapshot, 'attempts' | 'corruptRows' | 'profile' | 'profileRevision'>,
  ) => publish({ ...next, owner: input.owner, state: 'ready' });
  const failed = (error: ProgressSnapshot['error'], preserveReady = snapshot.state === 'ready') =>
    publish({ ...snapshot, error, state: preserveReady ? 'ready' : 'error', refreshing: false });
  const actions = createStoreActions(input, {
    failed,
    getSnapshot: () => snapshot,
    guest,
    loading: () =>
      publish({
        ...snapshot,
        error: undefined,
        state: snapshot.state === 'ready' ? 'ready' : 'loading',
        refreshing: snapshot.state === 'ready',
      }),
    member,
    queue,
    ready,
    setGeneration: async (next) => {
      generation = next;
      if (queue) await queue.setServerGeneration(next);
    },
  });
  return {
    ...actions,
    async dispose(clearPending = false) {
      active = false;
      if (clearPending && queue) await queue.discard();
      listeners.clear();
    },
    async finalizeExam(draft, events) {
      if (!exams) throw new Error('Guest exams use local storage.');
      const result = await exams.finalize(draft, events);
      if (member) {
        const snapshot = await actions.initialize();
        if (snapshot.error === 'load') throw new Error('Finalized exam could not be reloaded.');
      }
      return result;
    },
    getSnapshot: () => snapshot,
    async loadExam(certificationId) {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.load(certificationId);
    },
    async readExamClock() {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.readClock();
    },
    async saveExamResponse(draft, position, key, response) {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.save(draft, position, key, response);
    },
    async startExam(draft, certificationId, sourceVersion, durationMs) {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.start(draft, certificationId, sourceVersion, durationMs);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
