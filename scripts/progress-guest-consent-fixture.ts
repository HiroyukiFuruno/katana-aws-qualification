import { createProgressStore } from '../src/progress';
import { memberAttempt, type memoryStorage } from './progress-store-fixture';

export const owner = { generation: 1, kind: 'guest' as const };
export const examKey = 'katana.certification-exam.v1.saa-c03';
export const wrong = (stamp: string) => ({
  ...memberAttempt,
  answeredAt: stamp,
  isCorrect: false,
  questionId: 'same',
  reward: 0,
  selected: ['wrong'],
});
export const draft = {
  deadline: 1_800_000_000_000,
  id: '00000000-0000-0000-0000-000000000001',
  order: ['["exam",1]'],
  position: 0,
  responses: { '["exam",1]': { durationMs: 1, flagged: false, selected: ['a'] } },
};

export function store(storage: ReturnType<typeof memoryStorage>) {
  return createProgressStore({ isCurrent: () => true, owner, storage });
}

export async function append(next: ReturnType<typeof store>, stamp: string) {
  return next.appendAttempt('saa-c03', wrong(stamp), (attempts) => {
    const same = attempts.filter((attempt) => attempt.questionId === 'same');
    return { ...wrong(stamp), attemptNumber: same.length + 1, priorIncorrectCount: same.length };
  });
}
