import { profileKey } from '../assessment';
import type { Attempt } from '../attempts';
import { historyKey } from '../history';
import { legacyIncorrectIndex } from '../learningStorage';
import type { GuestProgressRepository } from './guest';
import { clearGuestExams, readGuestExam, saveGuestExam } from './guestExam';
import { updateGuestHistory } from './storeGuestHistory';
import type { ProgressReadyData, ProgressSnapshot } from './storeTypes';

function readyData(
  snapshot: ProgressSnapshot,
  attempts: Attempt[],
  corruptRows: number,
): ProgressReadyData {
  return {
    attempts,
    corruptRows,
    profile: snapshot.profile,
    profileRevision: snapshot.profileRevision,
  };
}

export function readGuestExamDraft(guest: GuestProgressRepository, key: string) {
  return readGuestExam(guest, key);
}

export function saveGuestExamDraft(
  guest: GuestProgressRepository,
  key: string,
  draft: Parameters<typeof saveGuestExam>[2],
) {
  saveGuestExam(guest, key, draft);
}

export function removeGuestExamDraft(guest: GuestProgressRepository, key: string) {
  guest.purge(key);
}

export function resetGuestExamDrafts(guest: GuestProgressRepository) {
  clearGuestExams(guest);
}

export function resetGuestProgress(guest: GuestProgressRepository) {
  guest.purge(historyKey);
  guest.purge(profileKey);
  guest.purge(legacyIncorrectIndex);
  resetGuestExamDrafts(guest);
}

export function finalizeGuestExam(
  guest: GuestProgressRepository,
  snapshot: ProgressSnapshot,
  examId: string,
  events: Attempt[],
) {
  const stored = updateGuestHistory(guest, (attempts) => {
    const existing = attempts.filter((attempt) => attempt.examId === examId);
    if (existing.length) return { attempts, value: { attempts: existing } };
    return { attempts: [...attempts, ...events], value: { attempts: events } };
  });
  return {
    attempts: stored.value.attempts,
    history: stored.attempts,
    ready: readyData(snapshot, stored.attempts, 0),
  };
}
