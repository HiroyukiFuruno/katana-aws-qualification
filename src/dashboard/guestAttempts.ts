import type { Attempt } from '../attempts';
import { timestamp } from '../fundamentals/state/codecPrimitives';
import { canonicalAttemptKey, sameStrings, stableAttemptId } from '../progress/migrationCodec';
import type { LegacyQuestionResolver } from '../progress/migrationTypes';
import { examDomainOf, isCorrectAnswer, type Question } from '../questions';
import type { DashboardEvent, DashboardRecords } from './eventTypes';

function matchesQuestion(attempt: Attempt, question: Question) {
  const choices = question.choices.map((choice) => choice.id);
  const category = question.locale ? examDomainOf(question) : question.category;
  return (
    attempt.sourceVersion === question.version &&
    attempt.category === category &&
    attempt.format === question.format &&
    sameStrings(attempt.correct, question.correct) &&
    new Set(attempt.selected).size === attempt.selected.length &&
    attempt.selected.every((id) => choices.includes(id)) &&
    attempt.isCorrect === isCorrectAnswer(question, attempt.selected) &&
    Number.isSafeInteger(attempt.durationMs) &&
    attempt.durationMs >= 0 &&
    attempt.durationMs <= 86400000 &&
    Number.isSafeInteger(attempt.questionRevision) &&
    attempt.questionRevision > 0
  );
}

export async function dashboardGuestAttempts(attempts: Attempt[], resolve: LegacyQuestionResolver) {
  const events: DashboardEvent[] = [];
  const occurrences = new Map<string, number>();
  let excludedRecords = 0;
  for (const attempt of attempts) {
    const key = canonicalAttemptKey(attempt);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const resolved = await resolve(attempt.questionId, attempt.questionRevision);
    let validTimestamp = true;
    try {
      timestamp(attempt.answeredAt, 'attempt.answeredAt');
    } catch {
      validTimestamp = false;
    }
    if (
      !resolved ||
      !matchesQuestion(attempt, resolved.question) ||
      !validTimestamp ||
      (attempt.mode === 'exam' && !attempt.examId)
    ) {
      excludedRecords++;
      continue;
    }
    events.push({
      eventId: await stableAttemptId(attempt, occurrence),
      certificationId: resolved.certificationId,
      questionId: attempt.questionId,
      questionRevision: attempt.questionRevision,
      sourceVersion: attempt.sourceVersion,
      category: attempt.category,
      mode: attempt.mode,
      context: attempt.mode === 'exam' ? 'exam' : 'practice',
      format:
        attempt.format ?? (resolved.question.correct.length > 1 ? 'choice-multiple' : 'choice-single'),
      polarity: 'unspecified',
      unitId: null,
      contentVersion: null,
      answeredAt: attempt.answeredAt,
      isCorrect: attempt.isCorrect,
      durationMs: attempt.durationMs,
      examId: attempt.mode === 'exam' ? (attempt.examId ?? null) : null,
      sessionId: null,
    });
  }
  const grouped = new Map<string, DashboardEvent[]>();
  for (const event of events) {
    if (event.examId === null) continue;
    const group = grouped.get(event.examId) ?? [];
    group.push(event);
    grouped.set(event.examId, group);
  }
  const invalid = new Set<string>();
  const exams: DashboardRecords['exams'] = [];
  for (const [examId, answers] of grouped) {
    const first = answers[0];
    if (
      answers.some(
        (answer) =>
          answer.certificationId !== first.certificationId ||
          answer.sourceVersion !== first.sourceVersion,
      ) ||
      new Set(answers.map((answer) => JSON.stringify([answer.questionId, answer.questionRevision])))
        .size !== answers.length
    ) {
      invalid.add(examId);
      excludedRecords += answers.length;
      continue;
    }
    exams.push({
      examId,
      certificationId: first.certificationId,
      sourceVersion: first.sourceVersion,
      startedAt: null,
      submittedAt: null,
      lastAnsweredAt: answers.reduce(
        (latest, answer) =>
          Date.parse(answer.answeredAt) > Date.parse(latest) ? answer.answeredAt : latest,
        first.answeredAt,
      ),
      questionCount: null,
    });
  }
  return {
    events: events.filter((event) => event.examId === null || !invalid.has(event.examId)),
    exams,
    excludedRecords,
  };
}
