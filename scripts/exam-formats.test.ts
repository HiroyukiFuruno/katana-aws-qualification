import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { certifications } from '../src/certifications';
import { examDurationMinutes, examPresetCounts, newExam, selectExamQuestions } from '../src/exam';
import { examDomainOf, questionKey, type Question } from '../src/questions';

const course = certifications.find(({ id }) => id === 'sap-c03')?.course;
if (!course) throw new Error('SAP-C03 course missing');
const blueprint = course.exam;
const bank = JSON.parse(readFileSync(`public/${course.mock}`, 'utf8')) as Question[];

test('reviewed SAP-C03 presets show the official full length and scaled shorter times', () => {
  const counts = examPresetCounts(blueprint);
  expect(counts).toEqual({ short: 15, medium: 30, full: 75 });
  expect(Object.values(counts).map((count) => examDurationMinutes(blueprint, count))).toEqual([
    36, 72, 180,
  ]);
  expect(examDurationMinutes(blueprint, 23)).toBe(56);
});

test('preset sizes fit existing compact mock exams', () => {
  expect(examPresetCounts({ minutes: 18, distribution: { fundamentals: 9 } })).toEqual({
    short: 3,
    medium: 5,
    full: 9,
  });
});

test('CLF-C02 full mocks count legacy questions in their exam domains', () => {
  const clf = certifications.find(({ id }) => id === 'clf-c02')?.course;
  if (!clf) throw new Error('CLF-C02 course missing');
  const questions = JSON.parse(readFileSync(`public/${clf.mock}`, 'utf8')) as Question[];
  const legacy = questions.filter((question) => question.id.startsWith('clf-c02-practice-'));
  expect(legacy).toHaveLength(10);
  const first = selectExamQuestions(questions, clf.exam);
  expect(first).toHaveLength(65);
  expect(first.filter((question) => legacy.includes(question))).toHaveLength(9);
  for (const [domain, count] of Object.entries(clf.exam.distribution)) {
    expect(first.filter((question) => examDomainOf(question) === domain)).toHaveLength(count);
  }
  expect(newExam(questions, clf.exam, 0).deadline).toBe(90 * 60_000);
});

test('each custom count starts with unique questions and the displayed deadline', () => {
  const byKey = new Map(bank.map((question) => [questionKey(question), question]));
  const now = 1_000;
  for (let count = 1; count <= 75; count++) {
    const draft = newExam(bank, blueprint, now, count);
    expect(draft.order).toHaveLength(count);
    expect(draft.deadline).toBe(now + examDurationMinutes(blueprint, count) * 60_000);
    const groups = draft.order.map((key) => {
      const question = byKey.get(key);
      if (!question) throw new Error(`Missing selected question ${key}`);
      return question.similarityGroup ? `group:${question.similarityGroup}` : `id:${question.id}`;
    });
    expect(new Set(groups).size).toBe(count);
  }
  for (const invalid of [0, 1.5, 76]) {
    expect(() => newExam(bank, blueprint, now, invalid)).toThrow();
  }
  const full = selectExamQuestions(bank, blueprint);
  for (const [category, quota] of Object.entries(blueprint.distribution)) {
    expect(full.filter((question) => question.category === category)).toHaveLength(quota);
  }
});
