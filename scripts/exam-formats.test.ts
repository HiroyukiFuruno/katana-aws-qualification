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

test('AIF-C01 full mocks use the published length and all five domains', () => {
  const aif = certifications.find(({ id }) => id === 'aif-c01')?.course;
  if (!aif) throw new Error('AIF-C01 course missing');
  const questions = JSON.parse(readFileSync(`public/${aif.mock}`, 'utf8')) as Question[];
  const byKey = new Map(questions.map((question) => [questionKey(question), question]));
  const draft = newExam(questions, aif.exam, 0);
  const selected = draft.order.map((key) => {
    const question = byKey.get(key);
    if (!question) throw new Error(`Missing selected question ${key}`);
    return question;
  });
  expect(selected).toHaveLength(65);
  expect(draft.deadline).toBe(90 * 60_000);
  expect(Object.values(aif.exam.distribution)).toEqual([13, 16, 18, 9, 9]);
  for (const [domain, count] of Object.entries(aif.exam.distribution)) {
    expect(selected.filter((question) => examDomainOf(question) === domain)).toHaveLength(count);
  }
  expect(
    new Set(selected.map((q) => (q.similarityGroup ? `group:${q.similarityGroup}` : `id:${q.id}`))).size,
  ).toBe(65);
  expect(examPresetCounts(aif.exam)).toEqual({ short: 15, medium: 30, full: 65 });
  expect(new Set(questions.map((question) => question.format))).toEqual(
    new Set([undefined, 'ordering', 'matching']),
  );
});

test('DVA-C03 provides five distinct full mocks and keeps DVA-C02 saved question versions', () => {
  const developer = certifications.find(({ id }) => id === 'dva-c03')?.course;
  if (!developer) throw new Error('DVA-C03 course missing');
  const load = (path: string) => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as Question[];
  const questions = load(developer.mock);
  const archived = developer.archives.flatMap(load);
  const group = (question: Question) => question.similarityGroup ?? question.id;
  expect(developer.reviewedMock).toBe(true);
  expect(developer.examStorageId).toBe('dva-c02');
  expect(examPresetCounts(developer.exam)).toEqual({ short: 15, medium: 30, full: 65 });
  expect(newExam(questions, developer.exam, 0).deadline).toBe(130 * 60_000);
  expect(Object.values(developer.exam.distribution)).toEqual([20, 17, 14, 14]);
  expect(new Set(archived.map(questionKey)).size).toBe(16);
  expect(certifications.some(({ id }) => id === 'dva-c02')).toBe(false);
  for (const previous of archived) {
    const current = questions.find((question) => questionKey(question) === questionKey(previous));
    if (current) {
      expect(current.prompt).toBe(previous.prompt);
      expect(current.choices).toEqual(previous.choices);
      expect(current.correct).toEqual(previous.correct);
    }
  }
  let available = questions;
  for (let attempt = 0; attempt < 5; attempt++) {
    const selected = selectExamQuestions(available, developer.exam);
    const selectedGroups = new Set(selected.map(group));
    expect(selectedGroups.size).toBe(65);
    for (const [domain, quota] of Object.entries(developer.exam.distribution)) {
      expect(selected.filter((question) => examDomainOf(question) === domain)).toHaveLength(quota);
    }
    available = available.filter((question) => !selectedGroups.has(group(question)));
  }
  expect(available).toHaveLength(0);
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

test('SCS-C03 uses the 65-question blueprint and resolves old compact drafts by revision', () => {
  const security = certifications.find(({ id }) => id === 'scs-c03')?.course;
  if (!security) throw new Error('SCS-C03 course missing');
  const questions = JSON.parse(readFileSync(`public/${security.mock}`, 'utf8')) as Question[];
  const compact = JSON.parse(
    readFileSync('public/courses/scs-c03/mock-2026-11.json', 'utf8'),
  ) as Question[];
  expect(security.examStorageId).toBe('scs-c03');
  expect(security.archives).toContain('courses/scs-c03/mock-2026-11.json');
  expect(security.archives).toContain('courses/scs-c03/questions.json');
  expect(new Set(compact.map((question) => question.similarityGroup ?? question.id)).size).toBe(9);
  expect(questions).toHaveLength(325);
  expect(questions.some((question) => questionKey(question) === questionKey(compact[0]))).toBe(false);
  expect(examPresetCounts(security.exam)).toEqual({ short: 15, medium: 30, full: 65 });
  expect(Object.values(security.exam.distribution)).toEqual([10, 9, 12, 13, 12, 9]);
  expect(newExam(questions, security.exam, 0).deadline).toBe(170 * 60_000);
});
