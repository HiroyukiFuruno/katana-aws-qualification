import { profileKey } from '../assessment';
import type { Attempt } from '../attempts';
import { historyKey } from '../history';
import { legacyIncorrectIndex } from '../learningStorage';
import { parseStoredAttempts } from './attemptCodec';
import type { GuestProgressRepository } from './guest';
import { clearGuestExams, readGuestExam, saveGuestExam } from './guestExam';
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
  guest.remove(key);
}

export function resetGuestExamDrafts(guest: GuestProgressRepository) {
  clearGuestExams(guest);
}

export function resetGuestProgress(guest: GuestProgressRepository) {
  guest.remove(historyKey);
  guest.remove(profileKey);
  guest.remove(legacyIncorrectIndex);
  resetGuestExamDrafts(guest);
}

export function finalizeGuestExam(
  guest: GuestProgressRepository,
  snapshot: ProgressSnapshot,
  examId: string,
  events: Attempt[],
) {
  const existing = snapshot.attempts.filter((attempt) => attempt.examId === examId);
  if (existing.length) return { attempts: existing, history: snapshot.attempts, ready: undefined };
  if (guest.write(historyKey, JSON.stringify([...snapshot.attempts, ...events])) === 'failed') {
    throw new Error('Guest exam was not saved.');
  }
  const stored = parseStoredAttempts(guest.read(historyKey));
  return {
    attempts: events,
    history: stored.attempts,
    ready: readyData(snapshot, stored.attempts, stored.corruptRows),
  };
}
