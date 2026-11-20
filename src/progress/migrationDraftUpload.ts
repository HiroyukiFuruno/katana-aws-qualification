import type { MigrationContext, Upload } from './migrationContext';
import { draft } from './migrationLegacy';
import type { LegacyQuestionResolution } from './migrationTypes';
import { ref, type QuestionRef } from './migrationCodec';
export async function uploadDraft(
  context: MigrationContext,
  raw: string,
  manifestId: string,
  completed: boolean,
): Promise<Upload> {
  const saved = draft(raw);
  if (!saved || saved.deadline <= Date.now()) {
    if (!completed) await context.reject(manifestId, 'draft', 'corrupt_or_expired_draft');
    return { events: [], imported: 0, rejected: 1 };
  }
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
  if (!completed)
    await context.repository.write<string>('import_exam_session', {
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
    });
  return { events: [], imported: 1, rejected: 0 };
}
