import type { ExamDraft } from '../exam';
import { examKeyPrefix, legacyExamKey } from '../learningStorage';
import type { GuestProgressRepository } from './guest';
import { isGuestExamDraft } from './guestExamCodec';

export function readGuestExam(guest: GuestProgressRepository, key: string) {
  const raw = guest.read(key);
  if (raw === null) return undefined;
  const value: unknown = JSON.parse(raw);
  if (!isGuestExamDraft(value)) throw new Error('Invalid guest exam draft.');
  return value;
}

export function saveGuestExam(guest: GuestProgressRepository, key: string, draft: ExamDraft) {
  if (!isGuestExamDraft(draft) || guest.write(key, JSON.stringify(draft)) === 'failed') {
    throw new Error('Guest exam draft was not saved.');
  }
}

export function clearGuestExams(guest: GuestProgressRepository) {
  guest.remove(legacyExamKey);
  guest.removeMatching(examKeyPrefix);
}
