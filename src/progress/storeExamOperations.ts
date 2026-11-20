import type { ExamDraft, ExamResponse } from '../exam';
import { isGenerationConflict } from './errors';
import type { ExamFinalizationEvent } from './examFinalization';
import type { SubmittedExamDraft } from './examRepositoryRead';
import type { ProgressSnapshot } from './storeTypes';

type MemberExamOperations = {
  finalize(draft: ExamDraft, events: ExamFinalizationEvent[]): Promise<string>;
  load(certificationId: string): Promise<ExamDraft | undefined>;
  loadSubmitted(certificationId: string): Promise<SubmittedExamDraft | undefined>;
  readClock(): Promise<string>;
  save(draft: ExamDraft, position: number, key: string, response: ExamResponse): Promise<ExamDraft>;
  start(
    draft: ExamDraft,
    certificationId: string,
    sourceVersion: string,
    durationMs: number,
  ): Promise<ExamDraft>;
};

type Dependencies = {
  exams?: MemberExamOperations;
  initialize(): Promise<ProgressSnapshot>;
  isCurrent(): boolean;
  notifyChanged(): void;
};

export function createStoreExamOperations({
  exams,
  initialize,
  isCurrent,
  notifyChanged,
}: Dependencies) {
  async function execute<T>(operation: (repository: MemberExamOperations) => Promise<T>) {
    if (!exams) throw new Error('Guest exams use local storage.');
    try {
      return await operation(exams);
    } catch (error) {
      if (isGenerationConflict(error) && isCurrent()) {
        try {
          const refreshed = await initialize();
          if (
            isCurrent() &&
            refreshed.state === 'ready' &&
            !refreshed.refreshing &&
            refreshed.error !== 'load'
          )
            notifyChanged();
        } catch {
          // initialize の global error を残し、元の PT409 を caller へ返す。
        }
      }
      throw error;
    }
  }
  return {
    finalize: (draft: ExamDraft, events: ExamFinalizationEvent[]) =>
      execute((repository) => repository.finalize(draft, events)),
    load: (certificationId: string) => execute((repository) => repository.load(certificationId)),
    loadSubmitted: (certificationId: string) =>
      execute((repository) => repository.loadSubmitted(certificationId)),
    readClock: () => execute((repository) => repository.readClock()),
    save: (draft: ExamDraft, position: number, key: string, response: ExamResponse) =>
      execute((repository) => repository.save(draft, position, key, response)),
    start: (draft: ExamDraft, certificationId: string, sourceVersion: string, durationMs: number) =>
      execute((repository) => repository.start(draft, certificationId, sourceVersion, durationMs)),
  };
}
