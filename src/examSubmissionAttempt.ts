import type { ExamDraft } from './exam';

export class ExamSubmissionAttempt {
  private draft: ExamDraft | undefined;
  private guestFingerprint: string | undefined;

  prepare(draft: ExamDraft) {
    this.draft = draft;
    this.guestFingerprint = undefined;
    return draft;
  }

  prepareGuest(draft: ExamDraft) {
    this.draft = draft;
    this.guestFingerprint = JSON.stringify(draft);
    return draft;
  }

  retry(draft: ExamDraft) {
    return this.draft?.id === draft.id && this.draft.revision === draft.revision
      ? this.draft
      : undefined;
  }

  retryGuest(draft: ExamDraft) {
    return this.guestFingerprint === JSON.stringify(draft) ? this.draft : undefined;
  }
}
