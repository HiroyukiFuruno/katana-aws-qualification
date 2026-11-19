import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { certifications } from '../src/certifications';
import { newExam } from '../src/exam';
import { type Question, examDomainOf, questionGroupKey, questionKey } from '../src/questions';

const findCourse = () => {
  const course = certifications.find(({ id }) => id === 'mla-c01')?.course;
  if (!course) throw new Error('MLA-C01 course missing');
  return course;
};

const readBank = (path: string) => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as Question[];

test('MLA-C01 exposes enough independent questions for five 65-question mocks', () => {
  const { exam, mock, practice, fixedExamFromBlueprint, reviewedMock } = findCourse();
  const questions = readBank(mock);
  expect(practice.some(({ path }) => path === mock)).toBe(true);
  expect(fixedExamFromBlueprint && reviewedMock).toBe(true);
  expect(questions).toHaveLength(325);
  expect(new Set(questions.map(questionGroupKey)).size).toBe(325);
  for (const [domain, count] of Object.entries(exam.distribution)) {
    expect(questions.filter((question) => examDomainOf(question) === domain)).toHaveLength(count * 5);
  }
  const attempt = newExam(questions, exam, 0);
  expect(attempt.order).toHaveLength(65);
  expect(attempt.deadline).toBe(130 * 60_000);
});

test('MLA-C01 retains the storage identity and both archived banks', () => {
  const { archives, examStorageId, mock } = findCourse();
  expect(examStorageId).toBe('mla-c01');
  expect(archives).toEqual(['courses/mla-c01/questions.json', 'courses/mla-c01/mock-2026-11.json']);
  const archivedKeys = new Set(archives.flatMap(readBank).map(questionKey));
  expect(archivedKeys.size).toBe(16);
  expect(readBank(mock).some((question) => archivedKeys.has(questionKey(question)))).toBe(false);
});
