import type { LessonRecordAsset, LessonRecordQuestion } from '../fundamentals/delivery/recordAsset';
import { gradeLessonFinal, isLessonAnswerCorrect } from '../fundamentals/state/grade';
import { guestLessonSnapshot } from '../fundamentals/state/guestSnapshot';
import type { LessonSummary } from '../fundamentals/state/memberTypes';
import type { GuestLessonSource } from '../fundamentals/state/types';
import type { DashboardEvent, DashboardRecords } from './eventTypes';

function lessonEvent(
  question: LessonRecordQuestion,
  source: GuestLessonSource,
  input: {
    eventId: string;
    selected: string[];
    answeredAt: string;
    durationMs: number;
    sessionId: string | null;
  },
): DashboardEvent {
  return {
    eventId: input.eventId,
    certificationId: 'fundamentals',
    questionId: question.id,
    questionRevision: question.revision,
    sourceVersion: question.version,
    category: question.category,
    mode: 'study',
    context: input.sessionId === null ? 'lesson-checkpoint' : 'lesson-final',
    format: question.requiredChoices > 1 ? 'choice-multiple' : 'choice-single',
    polarity: question.selectionPolarity,
    unitId: source.unitId,
    contentVersion: source.contentVersion,
    answeredAt: input.answeredAt,
    isCorrect: isLessonAnswerCorrect(question, input.selected),
    durationMs: input.durationMs,
    examId: null,
    sessionId: input.sessionId,
  };
}

export function dashboardGuestLesson(source: GuestLessonSource, asset: LessonRecordAsset) {
  const events = source.checkpointReceipts.map((receipt) => {
    const step = asset.steps.find((item) => item.id === receipt.stepId);
    const question = asset.checkpoints.find((item) => item.id === step?.assessmentId);
    if (!question) throw new Error('Unknown lesson checkpoint.');
    return lessonEvent(question, source, { ...receipt, eventId: receipt.receiptId, sessionId: null });
  });
  const lessonFinals: DashboardRecords['lessonFinals'] = source.submittedFinals.map((session) => {
    asset.finalQuestions.forEach((question, position) => {
      const response = session.responses[String(position)];
      events.push(
        lessonEvent(question, source, {
          eventId: session.eventIds[position],
          selected: response?.selected ?? [],
          answeredAt: response?.selectedAt ?? session.submittedAt,
          durationMs: response?.durationMs ?? 0,
          sessionId: session.sessionId,
        }),
      );
    });
    return {
      sessionId: session.sessionId,
      unitId: source.unitId,
      contentVersion: source.contentVersion,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      questionCount: asset.finalPolicy.questionCount,
      ...gradeLessonFinal(asset.finalQuestions, session.responses),
    };
  });
  const snapshot = guestLessonSnapshot(source, asset);
  const latest = snapshot.sessions.filter((session) => session.state === 'submitted').at(-1);
  const summary: LessonSummary = {
    unitId: source.unitId,
    contentVersion: source.contentVersion,
    completedSlides: source.completedSlideIds.length,
    totalSlides: asset.steps.filter((step) => step.kind !== 'checkpoint' && step.kind !== 'final')
      .length,
    completedCheckpoints: source.completedCheckpointIds.length,
    totalCheckpoints: asset.checkpoints.length,
    activeFinalSessionId: source.activeFinal?.sessionId ?? null,
    passedAt: snapshot.progress.passedAt,
    latestScore: latest?.score ?? null,
    requiredScore: latest?.requiredScore ?? null,
  };
  return { events, lessonFinals, summary };
}
