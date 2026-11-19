import type { Attempt } from '../attempts';
import { questionKey } from '../questions';
import type { FundamentalsQuestion, FundamentalsUnit } from './types';

export type FundamentalsSession = {
  unitId: string;
  review: boolean;
  questions: FundamentalsQuestion[];
  index: number;
};

export function latestFor(history: Attempt[]) {
  const latest = new Map<string, Attempt>();
  for (const attempt of history) {
    const key = questionKey({ id: attempt.questionId, revision: attempt.questionRevision });
    const current = latest.get(key);
    if (!current || attempt.answeredAt >= current.answeredAt) latest.set(key, attempt);
  }
  return latest;
}

function sessionQuestions(unit: FundamentalsUnit, history: Attempt[], review: boolean) {
  const latest = latestFor(history);
  return unit.questions.filter((question) => {
    const attempt = latest.get(questionKey(question));
    return review ? attempt !== undefined && !attempt.isCorrect : attempt === undefined;
  });
}

export function createSession(
  unit: FundamentalsUnit,
  history: Attempt[],
  review: boolean,
): FundamentalsSession {
  return { unitId: unit.id, review, questions: sessionQuestions(unit, history, review), index: 0 };
}

export function advanceSession(session: FundamentalsSession) {
  return session.index + 1 < session.questions.length
    ? { ...session, index: session.index + 1 }
    : session;
}

export function sessionComplete(session: FundamentalsSession) {
  return session.questions.length > 0 && session.index === session.questions.length - 1;
}

export function hasUnansweredQuestions(unit: FundamentalsUnit, history: Attempt[]) {
  return createSession(unit, history, false).questions.length > 0;
}
