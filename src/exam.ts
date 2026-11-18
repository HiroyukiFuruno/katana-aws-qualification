import type { ExamBlueprint } from './certifications';
import { questionKey, type Question } from './questions';

export type ExamResponse = {
  selected: string[];
  flagged: boolean;
  durationMs: number;
  selectedAt?: number;
};
export type ExamDraft = {
  id: string;
  deadline: number;
  order: string[];
  position: number;
  responses: Record<string, ExamResponse>;
};

export function canStartExam(questions: Question[], blueprint: ExamBlueprint) {
  return Object.entries(blueprint.distribution).every(
    ([category, count]) =>
      questions.filter((question) => question.category === category).length >= count,
  );
}

export function shuffle<T>(source: readonly T[]) {
  const items = [...source];
  for (let i = items.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [items[i], items[other]] = [items[other], items[i]];
  }
  return items;
}

export function newExam(
  questions: Question[],
  blueprint: ExamBlueprint,
  now = Date.now(),
  count?: number,
  fixed?: Question[],
): ExamDraft {
  if (!fixed && !canStartExam(questions, blueprint))
    throw new Error('模擬試験に必要な分野別の問題数を満たしていません。');
  const selected =
    fixed ??
    Object.entries(blueprint.distribution).flatMap(([category, count]) =>
      shuffle(questions.filter((question) => question.category === category)).slice(0, count),
    );
  const order = (fixed ?? shuffle(selected).slice(0, count)).map(questionKey);
  const fullLength = Object.values(blueprint.distribution).reduce((sum, value) => sum + value, 0);
  const duration = (blueprint.minutes * order.length) / fullLength;
  return {
    id: crypto.randomUUID(),
    deadline: now + Math.round(duration * 60_000),
    order,
    position: 0,
    responses: {},
  };
}

export function readExam(examKey: string): ExamDraft | undefined {
  const raw = localStorage.getItem(examKey);
  return raw ? JSON.parse(raw) : undefined;
}

export function storeExam(examKey: string, draft: ExamDraft) {
  localStorage.setItem(examKey, JSON.stringify(draft));
}

export function remainingLabel(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function getResponse(draft: ExamDraft, key: string): ExamResponse {
  return draft.responses[key] ?? { selected: [], flagged: false, durationMs: 0 };
}

export function isAnswered(draft: ExamDraft, question: Question) {
  return getResponse(draft, questionKey(question)).selected.length === question.correct.length;
}
