import { expect, test } from 'bun:test';
import { verifiesImportedEvents } from '../src/fundamentals/state/importEvents';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { lessonQuestionRef } from '../src/fundamentals/state/grade';
import { lessonAsset } from './fundamentals-state-fixture';

function source() {
  const value = initialGuestLesson(lessonAsset);
  const question = lessonAsset.checkpoints.find((item) => item.requiredChoices === 2);
  const step = lessonAsset.steps.find((item) => item.assessmentId === question?.id);
  if (!question || !step) throw new Error('Missing multiple-choice checkpoint fixture.');
  value.checkpointReceipts = [
    {
      stepId: step.id,
      receiptId: '10000000-0000-4000-8000-000000000002',
      questionRef: lessonQuestionRef(question),
      selected: question.correct,
      answeredAt: '2026-11-20T10:00:00.123456Z',
      durationMs: 321,
    },
  ];
  return { question, step, value };
}

test('accepts PostgreSQL timestamp spelling and canonical selection order only with matching event receipts', async () => {
  const fixture = source();
  const row = {
    event_id: fixture.value.checkpointReceipts[0]?.receiptId,
    certification_id: 'fundamentals',
    question_id: fixture.question.id,
    question_revision: fixture.question.revision,
    source_version: fixture.question.version,
    category: fixture.question.category,
    mode: 'study',
    selected: [...fixture.question.correct].reverse(),
    correct: [...fixture.question.correct].reverse(),
    is_correct: true,
    duration_ms: 321,
    answered_at: '2026-11-20T10:00:00.123456+00:00',
    fundamentals_session_id: null,
    selection_polarity: fixture.question.selectionPolarity,
    required_choices: fixture.question.requiredChoices,
    learning_context: {
      kind: 'lesson-checkpoint',
      unitId: lessonAsset.unit.id,
      contentVersion: lessonAsset.contentVersion,
      catalogHash: lessonAsset.contentHash,
      stepId: fixture.step.id,
      questionRef: lessonQuestionRef(fixture.question),
    },
  };
  const client = { rpc: async <T>() => undefined as T, select: async <T>() => [row] as T };
  await expect(verifiesImportedEvents(client, fixture.value, lessonAsset)).resolves.toBe(true);
  const missing = { ...client, select: async <T>() => [] as T };
  await expect(verifiesImportedEvents(missing, fixture.value, lessonAsset)).resolves.toBe(false);
});
