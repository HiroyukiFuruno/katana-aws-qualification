import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { certifications } from '../src/certifications';
import { newExam } from '../src/exam';
import {
  examDomainOf,
  isCorrectAnswer,
  type Question,
  questionGroupKey,
  questionKey,
} from '../src/questions';

const readBank = (path: string) => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as Question[];

test('AIP-C01 provides five disjoint 75-question mocks and preserves archived scoring', () => {
  const course = certifications.find(({ id }) => id === 'aip-c01')?.course;
  if (!course) throw new Error('AIP-C01 course missing');

  expect(course).toMatchObject({
    examStorageId: 'aip-c01',
    fixedExamFromBlueprint: true,
    reviewedMock: true,
    archives: ['courses/aip-c01/questions.json', 'courses/aip-c01/mock-2026-11.json'],
  });
  const bank = readBank(course.mock);
  const archived = course.archives.flatMap(readBank);
  expect(bank).toHaveLength(375);
  expect(new Set(bank.map(questionGroupKey)).size).toBe(375);
  expect(new Set([...bank, ...archived].map(questionKey)).size).toBe(391);
  expect(archived.every((question) => isCorrectAnswer(question, question.correct))).toBe(true);

  let remaining = bank;
  for (let form = 0; form < 5; form++) {
    const exam = newExam(remaining, course.exam, 0);
    const keys = new Set(exam.order);
    expect(keys.size).toBe(75);
    expect(exam.deadline).toBe(180 * 60_000);
    for (const [domain, count] of Object.entries(course.exam.distribution)) {
      expect(
        remaining.filter(
          (question) => keys.has(questionKey(question)) && examDomainOf(question) === domain,
        ),
      ).toHaveLength(count);
    }
    remaining = remaining.filter((question) => !keys.has(questionKey(question)));
  }
  expect(remaining).toHaveLength(0);
});
