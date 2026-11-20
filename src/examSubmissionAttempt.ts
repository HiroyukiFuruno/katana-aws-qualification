import type { ExamDraft } from './exam';

export class ExamSubmissionAttempt {
  private draft: ExamDraft | undefined;

  prepare(draft: ExamDraft) {
    this.draft = draft;
    return draft;
  }

  retry(draft: ExamDraft) {
    return this.draft?.id === draft.id && this.draft.revision === draft.revision
      ? this.draft
      : undefined;
  }
}
