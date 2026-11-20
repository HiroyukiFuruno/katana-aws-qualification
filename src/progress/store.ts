import { createMemberExamRepository } from './examRepository';
import { createGuestProgressRepository } from './guest';
import { createMemberProgressRepository } from './member';
import { MemberRetryQueue } from './retryQueue';
import { createStoreActions } from './storeActions';
import {
  finalizeGuestExam,
  readGuestExamDraft,
  removeGuestExamDraft,
  saveGuestExamDraft,
} from './storeGuestExams';
import {
  initialProgressSnapshot,
  type ProgressSnapshot,
  type ProgressStore,
  type ProgressStoreInput,
} from './storeTypes';
import { assertCurrentProgressOwner, type ProgressOperation } from './types';

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
  let snapshotVersion = 0;
  const publish = (next: ProgressSnapshot) => {
    snapshot = next;
    snapshotVersion += 1;
    for (const listener of listeners) listener();
  };
  const ready = (
    next: Pick<ProgressSnapshot, 'attempts' | 'corruptRows' | 'profile' | 'profileRevision'>,
  ) =>
    publish({
      ...next,
      owner: input.owner,
      examRefreshVersion: snapshot.examRefreshVersion,
      state: 'ready',
    });
  const failed = (error: ProgressSnapshot['error'], preserveReady = snapshot.state === 'ready') =>
    publish({ ...snapshot, error, state: preserveReady ? 'ready' : 'error', refreshing: false });
  const actions = createStoreActions(input, {
    failed,
    getSnapshot: () => snapshot,
    getSnapshotVersion: () => snapshotVersion,
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
    async finalizeGuestExam(examId, events) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      const result = finalizeGuestExam(guest, snapshot, examId, events);
      if (result.ready) ready(result.ready);
      return { attempts: result.attempts, history: result.history };
    },
    getSnapshot: () => snapshot,
    async loadExam(certificationId) {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.load(certificationId);
    },
    notifyExamSessionsChanged() {
      assertCurrentProgressOwner(operation);
      publish({ ...snapshot, examRefreshVersion: snapshot.examRefreshVersion + 1 });
    },
    readGuestExam(examKey) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      return readGuestExamDraft(guest, examKey);
    },
    async readExamClock() {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.readClock();
    },
    async saveExamResponse(draft, position, key, response) {
      if (!exams) throw new Error('Guest exams use local storage.');
      return exams.save(draft, position, key, response);
    },
    removeGuestExam(examKey) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      removeGuestExamDraft(guest, examKey);
    },
    async saveGuestExam(examKey, draft) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      saveGuestExamDraft(guest, examKey, draft);
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
