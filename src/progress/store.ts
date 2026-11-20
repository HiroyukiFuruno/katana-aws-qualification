import { createMemberExamRepository } from './examRepository';
import { canPersistGuestProgress, createGuestProgressRepository } from './guest';
import { createMemberProgressRepository } from './member';
import { MemberRetryQueue } from './retryQueue';
import { createStoreActions } from './storeActions';
import { createStoreExamOperations } from './storeExamOperations';
import {
  finalizeGuestExam,
  readGuestExamDraft,
  removeGuestExamDraft,
  saveGuestExamDraft,
} from './storeGuestExams';
import { resolveGuestStorageConflict } from './storeGuestStorageConflict';
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
  let guestPersistence = input.owner.kind === 'guest' && canPersistGuestProgress(input.storage);
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
  ) => {
    const persistence = input.owner.kind === 'guest' && canPersistGuestProgress(input.storage);
    const examRefreshVersion = snapshot.examRefreshVersion + Number(persistence !== guestPersistence);
    guestPersistence = persistence;
    publish({ ...next, owner: input.owner, examRefreshVersion, state: 'ready' });
  };
  const failed = (error: ProgressSnapshot['error'], preserveReady = snapshot.state === 'ready') =>
    publish({ ...snapshot, error, state: preserveReady ? 'ready' : 'error', refreshing: false });
  const notifyExamSessionsChanged = () => {
    assertCurrentProgressOwner(operation);
    publish({ ...snapshot, examRefreshVersion: snapshot.examRefreshVersion + 1 });
  };
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
  const examOperations = createStoreExamOperations({
    exams,
    initialize: actions.initialize,
    isCurrent: operation.isCurrent,
    notifyChanged: notifyExamSessionsChanged,
  });
  return {
    ...actions,
    async dispose(clearPending = false) {
      active = false;
      if (clearPending && queue) await queue.discard();
      listeners.clear();
    },
    async finalizeExam(draft, events) {
      const result = await examOperations.finalize(draft, events);
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
    guestStorageConflicts: () => guest?.storageConflicts() ?? [],
    loadExam: (certificationId) => examOperations.load(certificationId),
    loadSubmittedExam: (certificationId) => examOperations.loadSubmitted(certificationId),
    notifyExamSessionsChanged,
    readGuestExam(examKey) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      return readGuestExamDraft(guest, examKey);
    },
    readExamClock: () => examOperations.readClock(),
    async saveExamResponse(draft, position, key, response) {
      return examOperations.save(draft, position, key, response);
    },
    removeGuestExam(examKey) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      removeGuestExamDraft(guest, examKey);
    },
    async resolveGuestStorageConflict(key, choice) {
      if (!guest) throw new Error('Member storage conflicts cannot be resolved here.');
      await resolveGuestStorageConflict(
        guest,
        operation,
        actions.initialize,
        notifyExamSessionsChanged,
        key,
        choice,
      );
    },
    async saveGuestExam(examKey, draft) {
      if (!guest) throw new Error('Member exams use cloud storage.');
      saveGuestExamDraft(guest, examKey, draft);
    },
    async startExam(draft, certificationId, sourceVersion, durationMs) {
      return examOperations.start(draft, certificationId, sourceVersion, durationMs);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
