import { isCorrectAnswer, type Question, questionKey } from '../questions';
import { presentation } from './examRepositoryCodec';
import { type QuestionRef, ref } from './migrationCodec';
import type { MigrationContext, Upload } from './migrationContext';
import { draft } from './migrationLegacy';
import type { LegacyQuestionResolution } from './migrationTypes';

type Resolved = { certificationId: string; question: Question };

export async function isCompletedExamCache(
  context: MigrationContext,
  saved: Awaited<ReturnType<typeof draft>>,
  details: readonly Resolved[],
) {
  if (!saved) return false;
  const sessions =
    await context.select<
      {
        exam_id: string;
        certification_id: string;
        source_version: string;
        question_order: { question_id: string; question_revision: number }[];
        state: string;
      }[]
    >('exam_sessions');
  const session = sessions.find((item) => item.exam_id === saved.id && item.state === 'submitted');
  if (!session || session.question_order.length !== details.length) return false;
  if (new Set(details.map((item) => item.certificationId)).size !== 1) return false;
  if (
    session.certification_id !== details[0]?.certificationId ||
    session.source_version !== details[0]?.question.version
  )
    return false;
  if (new Set(saved.order).size !== saved.order.length) return false;
  const orderKeys = new Set(saved.order);
  if (Object.keys(saved.responses).some((key) => !orderKeys.has(key))) return false;
  const attempts = (await context.repository.loadAttempts()).filter(
    (attempt) => attempt.examId === saved.id,
  );
  if (attempts.length !== details.length) return false;
  return details.every(({ question }, index) => {
    const key = questionKey(question);
    const response = saved.responses[key];
    const attempt = attempts.find(
      (item) => item.questionId === question.id && item.questionRevision === question.revision,
    );
    if (attempt?.mode !== 'exam' || attempt.sourceVersion !== question.version) return false;
    if (
      session.question_order[index]?.question_id !== question.id ||
      session.question_order[index]?.question_revision !== question.revision
    )
      return false;
    if (attempt.category !== question.category || attempt.format !== question.format) return false;
    if (JSON.stringify(attempt.correct) !== JSON.stringify(question.correct)) return false;
    const selected = response?.selected ?? [];
    if (JSON.stringify(attempt.selected) !== JSON.stringify(selected)) return false;
    if (attempt.isCorrect !== isCorrectAnswer(question, selected)) return false;
    if (response && (response.durationMs > attempt.durationMs || response.durationMs < 0)) return false;
    const answeredAt = Date.parse(attempt.answeredAt);
    const selectedAt = response?.selectedAt;
    return (
      Number.isFinite(answeredAt) &&
      (selectedAt === undefined ||
        (Number.isInteger(selectedAt) &&
          selectedAt >= 0 &&
          answeredAt === Math.min(selectedAt, saved.deadline)))
    );
  });
}

export async function uploadDraft(
  context: MigrationContext,
  raw: string,
  manifestId: string,
  completed: boolean,
): Promise<Upload> {
  const saved = draft(raw);
  if (!saved) {
    if (!completed) await context.reject(manifestId, 'draft', 'corrupt_or_expired_draft');
    return { events: [], imported: 0, rejected: 1 };
  }
  const expired = saved.deadline <= Date.now();
  const refs = saved.order.map(ref);
  const questions = await Promise.all(
    refs.map((item) => item && context.input.resolveQuestion(item.id, item.revision)),
  );
  const details = questions.filter(
    (question): question is LegacyQuestionResolution => question !== undefined,
  );
  if (
    refs.some((item) => !item) ||
    details.length !== questions.length ||
    !details.length ||
    new Set(details.map((item) => item.certificationId)).size !== 1
  ) {
    if (!completed) await context.reject(manifestId, 'draft', 'unknown_certification');
    return { events: [], imported: 0, rejected: 1 };
  }
  const responses = Object.entries(saved.responses).map(([key, response]) => ({
    ref: ref(key),
    response,
  }));
  if (responses.some((item) => !item.ref)) {
    if (!completed) await context.reject(manifestId, 'draft', 'corrupt_draft');
    return { events: [], imported: 0, rejected: 1 };
  }
  const verifiedResponses = responses.filter(
    (item): item is { ref: QuestionRef; response: typeof item.response } => item.ref !== undefined,
  );
  const certificationId = details[0].certificationId;
  if (await isCompletedExamCache(context, saved, details))
    return { events: [], imported: 0, rejected: 0 };
  if (expired) {
    if (!completed) await context.reject(manifestId, 'draft', 'corrupt_or_expired_draft');
    return { events: [], imported: 0, rejected: 1 };
  }
  if (!completed)
    await context.repository.write<string>('import_exam_session_v2', {
      p_manifest_id: manifestId,
      p_source_row_id: 'draft',
      p_exam: {
        exam_id: saved.id,
        certification_id: certificationId,
        source_version: details[0].question.version,
        question_order: details.map((item) => ({
          question_id: item.question.id,
          question_revision: item.question.revision,
        })),
        position: saved.position,
        state: 'draft',
        legacy_import: true,
        started_at: null,
        deadline_at: new Date(saved.deadline).toISOString(),
        submitted_at: null,
      },
      p_draft_responses: verifiedResponses.map((item) => ({
        question_ref: { question_id: item.ref.id, question_revision: item.ref.revision },
        selected: item.response.selected,
        flagged: item.response.flagged,
        duration_ms: item.response.durationMs,
        selected_at: item.response.selectedAt ? new Date(item.response.selectedAt).toISOString() : null,
      })),
      p_events: [],
      p_presentation: presentation(saved.order, saved.choiceOrders),
    });
  return { events: [], imported: 1, rejected: 0 };
}
