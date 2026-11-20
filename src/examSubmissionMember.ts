import type { ExamDraft, ExamResponse } from './exam';
import type { ProgressStore } from './progress/storeTypes';

type MemberExamStore = Pick<ProgressStore, 'loadExam' | 'readExamClock' | 'saveExamResponse'>;

function isTimingError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === '22023'
  );
}

function sameResponse(left: ExamResponse | undefined, right: ExamResponse) {
  return (
    left?.durationMs === right.durationMs &&
    left.flagged === right.flagged &&
    left.selected.length === right.selected.length &&
    left.selected.every((value, index) => value === right.selected[index])
  );
}

function isSavedDraft(
  current: ExamDraft,
  key: string,
  response: ExamResponse,
  position: number,
  remote: ExamDraft,
) {
  return (
    remote.id === current.id &&
    remote.position === position &&
    remote.revision === (current.revision ?? 0) + 1 &&
    sameResponse(remote.responses[key], response)
  );
}

function isUnchangedDraft(current: ExamDraft, remote: ExamDraft) {
  return remote.id === current.id && remote.revision === current.revision;
}

async function recoverMemberExamSave(
  store: MemberExamStore,
  certificationId: string,
  current: ExamDraft,
  key: string,
  response: ExamResponse,
  position: number,
  error: unknown,
) {
  try {
    if (isTimingError(error)) {
      const serverNow = Date.parse(await store.readExamClock());
      const remote = await store.loadExam(certificationId);
      return remote && serverNow >= remote.deadline && isUnchangedDraft(current, remote)
        ? remote
        : undefined;
    }
    const remote = await store.loadExam(certificationId);
    return remote && isSavedDraft(current, key, response, position, remote) ? remote : undefined;
  } catch {
    return undefined;
  }
}

export async function persistFinalMemberResponse(
  store: MemberExamStore,
  certificationId: string,
  current: ExamDraft,
  key: string,
  response: ExamResponse,
) {
  return persistMemberResponse(store, certificationId, current, key, response, current.position);
}

export async function persistMemberResponse(
  store: MemberExamStore,
  certificationId: string,
  current: ExamDraft,
  key: string,
  response: ExamResponse,
  position: number,
) {
  try {
    return await store.saveExamResponse(
      { ...current, responses: { ...current.responses, [key]: response } },
      position,
      key,
      response,
    );
  } catch (error) {
    const recovered = await recoverMemberExamSave(
      store,
      certificationId,
      current,
      key,
      response,
      position,
      error,
    );
    if (recovered) return recovered;
    throw error;
  }
}

export async function finalMemberDraft(
  store: MemberExamStore,
  certificationId: string,
  current: ExamDraft,
  key: string,
  response: ExamResponse,
  elapsedMs: number,
  serverNow: number,
) {
  if (serverNow >= current.deadline) {
    const confirmed = await store.loadExam(certificationId);
    if (!confirmed || confirmed.id !== current.id) throw new Error('Confirmed exam is unavailable');
    return confirmed;
  }
  if (!response.selected.length && !response.flagged) return current;
  return persistFinalMemberResponse(store, certificationId, current, key, {
    ...response,
    durationMs: response.selected.length
      ? Math.max(0, Math.round(response.durationMs + Math.max(0, elapsedMs)))
      : 0,
  });
}
