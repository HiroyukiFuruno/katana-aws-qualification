import type { MigrationContext, Upload } from './migrationContext';
import { history, type LegacyAttempt } from './migrationLegacy';
import type { ImportedEvent } from './migrationVerification';
import type { LegacyQuestionResolution } from './migrationTypes';
import { canonicalAttemptKey, payload, stableAttemptId } from './migrationCodec';
export async function uploadHistory(
  context: MigrationContext,
  raw: string,
  manifestId: string,
  _sourceFingerprint: string,
  completed: boolean,
): Promise<Upload> {
  const parsed = history(raw);
  const events: ImportedEvent[] = [];
  let imported = 0;
  let rejected = parsed.errors;
  const occurrences = new Map<string, number>();
  const eventIdFor = (attempt: LegacyAttempt) => {
    const key = canonicalAttemptKey(attempt);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return stableAttemptId(attempt, occurrence);
  };
  for (let index = 0; index < parsed.errors; index++)
    if (!completed) await context.reject(manifestId, `corrupt-${index}`, 'corrupt_attempt');
  const exams = new Map<string, { attempt: LegacyAttempt; eventId: Promise<string> }[]>();
  for (const [ordinal, attempt] of parsed.rows.entries()) {
    const eventIdPromise = eventIdFor(attempt);
    if (attempt.mode === 'exam' && attempt.examId) {
      const group = exams.get(attempt.examId) ?? [];
      group.push({ attempt, eventId: eventIdPromise });
      exams.set(attempt.examId, group);
      continue;
    }
    const rowId = `history-${ordinal}`;
    const eventId = await eventIdPromise;
    const question = await context.resolve(attempt);
    if (!question) {
      rejected++;
      if (!completed) await context.reject(manifestId, rowId, 'unknown_certification');
      continue;
    }
    events.push({ attempt, certificationId: question.certificationId, eventId });
    if (!completed)
      await context.repository.write<string>('append_learning_event', {
        p_event: payload(attempt, question.certificationId, eventId),
        p_manifest_id: manifestId,
        p_source_row_id: rowId,
      });
    imported++;
  }
  for (const [examId, rows] of exams) {
    const rowId = `exam-${examId}`;
    const questions = await Promise.all(rows.map(({ attempt }) => context.resolve(attempt)));
    const ids = await Promise.all(rows.map(({ eventId }) => eventId));
    const details = questions.filter(
      (question): question is LegacyQuestionResolution => question !== undefined,
    );
    if (
      details.length !== questions.length ||
      !details.length ||
      new Set(details.map((question) => question.certificationId)).size !== 1
    ) {
      rejected++;
      if (!completed) await context.reject(manifestId, rowId, 'unknown_certification');
      continue;
    }
    const certificationId = details[0].certificationId;
    events.push(
      ...rows.map(({ attempt }, index) => ({ attempt, certificationId, eventId: ids[index] })),
    );
    if (!completed)
      await context.repository.write<string>('import_exam_session', {
        p_manifest_id: manifestId,
        p_source_row_id: rowId,
        p_exam: {
          exam_id: examId,
          certification_id: certificationId,
          source_version: rows[0].attempt.sourceVersion,
          question_order: details.map((question) => ({
            question_id: question.question.id,
            question_revision: question.question.revision,
          })),
          position: 0,
          state: 'submitted',
          legacy_import: true,
          started_at: null,
          deadline_at: null,
          submitted_at: null,
        },
        p_draft_responses: [],
        p_events: rows.map(({ attempt }, index) => payload(attempt, certificationId, ids[index])),
      });
    imported += rows.length;
  }
  return { events, imported, rejected };
}
