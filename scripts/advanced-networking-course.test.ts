import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { certifications } from '../src/certifications';
import { newExam } from '../src/exam';
import { isCorrectAnswer, questionKey, type Question } from '../src/questions';

const readBank = (path: string) => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as Question[];

test('ANS-C01 starts full exams and retains both archived question banks for saved attempts', () => {
  const course = certifications.find(({ id }) => id === 'ans-c01')?.course;
  if (!course) throw new Error('ANS-C01 course missing');

  const bank = readBank(course.mock);
  const archived = course.archives.flatMap(readBank);
  const draft = newExam(bank, course.exam, 0);

  expect(course.examStorageId).toBe('ans-c01');
  expect(course.reviewedMock).toBe(true);
  expect(course.archives).toEqual([
    'courses/ans-c01/questions.json',
    'courses/ans-c01/mock-2026-11.json',
  ]);
  expect(bank).toHaveLength(325);
  expect(draft.order).toHaveLength(65);
  expect(draft.deadline).toBe(170 * 60_000);
  expect(new Set(archived.map(questionKey)).size).toBe(16);
  expect(archived.every((question) => isCorrectAnswer(question, question.correct))).toBe(true);
});
