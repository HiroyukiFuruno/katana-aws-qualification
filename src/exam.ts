import type { ExamBlueprint } from './certifications';
import {
  examDomainOf,
  isAnswerComplete,
  type Question,
  questionGroupKey,
  questionKey,
} from './questions';

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
  revision?: number;
};

function uniqueExamQuestions(questions: readonly Question[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = questionGroupKey(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function examLength(blueprint: ExamBlueprint) {
  return Object.values(blueprint.distribution).reduce((sum, count) => sum + count, 0);
}

export function examPresetCounts(blueprint: ExamBlueprint) {
  const full = examLength(blueprint);
  return {
    short: Math.min(15, Math.max(1, Math.floor(full / 3))),
    medium: Math.min(30, Math.ceil(full / 2)),
    full,
  };
}

export function examDurationMinutes(blueprint: ExamBlueprint, count: number) {
  return Math.ceil((blueprint.minutes * count) / examLength(blueprint));
}

export function selectExamQuestions(
  questions: Question[],
  blueprint: ExamBlueprint,
  count = examLength(blueprint),
) {
  const fullLength = examLength(blueprint);
  if (!Number.isInteger(count) || count < 1 || count > fullLength) return [];
  const distinct = uniqueExamQuestions(questions);
  const quotas = Object.entries(blueprint.distribution).map(([category, target]) => ({
    category,
    count: Math.floor((count * target) / fullLength),
    remainder: (count * target) % fullLength,
  }));
  const unallocated = count - quotas.reduce((sum, quota) => sum + quota.count, 0);
  for (const quota of [...quotas].sort((a, b) => b.remainder - a.remainder).slice(0, unallocated)) {
    quota.count++;
  }
  const result = quotas.flatMap(({ category, count }) =>
    distinct.filter((question) => examDomainOf(question) === category).slice(0, count),
  );
  return result.length === count ? result : [];
}

export function canStartExam(questions: Question[], blueprint: ExamBlueprint) {
  return selectExamQuestions(questions, blueprint).length > 0;
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
): ExamDraft {
  const selected = shuffle(selectExamQuestions(shuffle(questions), blueprint, count));
  if (!selected.length) throw new Error('模擬試験に必要な分野別の問題数を満たしていません。');
  const order = selected.map(questionKey);
  return {
    id: crypto.randomUUID(),
    deadline: now + examDurationMinutes(blueprint, order.length) * 60_000,
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
  return isAnswerComplete(question, getResponse(draft, questionKey(question)).selected);
}
