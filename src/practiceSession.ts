import { questionKey, type Question } from './questions';
import { statsFor, type Attempt } from './history';
import { localizeSessionQuestions } from './questionPresentation';

export type PracticeSession = {
  questions: Question[];
  index: number;
  correct: number;
  translationError?: boolean;
};

export function practiceQuestion(saved: Question | undefined, available: ReadonlyMap<string, Question>) {
  if (!saved) return;
  const translated = available.get(questionKey(saved));
  // 欠損時は親が表示を隠す。既存の入力コンポーネントを保持するため原本は捨てない。
  return translated ? localizeSessionQuestions([saved], [translated])[0] : saved;
}

export function localizePracticeSession(current: PracticeSession | undefined, questions: Question[]) {
  if (!current) return current;
  try {
    return {
      ...current,
      questions: localizeSessionQuestions(current.questions, questions),
      translationError: false,
    };
  } catch (error) {
    if (!(error instanceof Error && error.message === 'invalidQuestionData')) throw error;
    return { ...current, translationError: true };
  }
}

export function practiceMetrics(history: Attempt[], questions: Question[], archivedBank: Question[]) {
  const courseIds = new Set([...questions, ...archivedBank].map((item) => item.id));
  const courseHistory = history.filter((attempt) => courseIds.has(attempt.questionId));
  const review = questions
    .map((question) => ({ question, ...statsFor(courseHistory, question) }))
    .filter((stats) => stats.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong);
  const answerCount = courseHistory.length;
  const rate = answerCount
    ? `${Math.round((100 * courseHistory.filter((attempt) => attempt.isCorrect).length) / answerCount)}%`
    : '—';
  return { courseIds, review, answerCount, rate };
}
