import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyCourses } from '../src/certifications';
import { messages } from '../src/messages';
import clarifications from '../src/question-clarifications.json';
import sourceLocales from '../src/question-source-locales.json';
import { parseQuestions, questionKey } from '../src/questions';
import { naturalQuestionHash } from './natural-translation-content';

const archive = 'courses/saa-c03/archive-2026-11-21.json';
const id = 'saa-c03-sec01x-002';
const read = (path: string) => parseQuestions(JSON.parse(readFileSync(`public/${path}`, 'utf8')));

test('Cognito revision archive preserves old grading and scopes its clarification to rev1', () => {
  const [previous] = read(archive);
  const current = read('courses/saa-c03/mock-questions.json').find((question) => question.id === id);
  assert(previous && current, 'Cognito question revisions are missing');
  expect(previous.id).toBe(id);
  expect(previous.revision).toBe(1);
  expect(current.revision).toBe(2);
  expect(previous.correct).toEqual(['A']);
  expect(current.correct).toEqual(['A']);
  expect(
    naturalQuestionHash({
      ...previous,
      categoryLabel: previous.category,
      examDomainLabel: previous.examDomain ?? previous.category,
      versionLabel: previous.version,
      sourceLabel: previous.source.label,
    }),
  ).toBe('4ab99a1954d6e58b42b9a66f9d88db013c3ca58f0b77e8b64b8356f315f8b6f6');
  const course = studyCourses.find((item) => item.id === 'saa-c03')?.course;
  expect(course?.archives).toContain(archive);
  expect(course?.practice?.map(({ path }) => path)).not.toContain(archive);
  expect(course?.mock).not.toBe(archive);
  expect(sourceLocales[archive]).toBe('ja');
  const index = JSON.parse(readFileSync('public/learning-question-index.v1.json', 'utf8'));
  expect(index.questions[questionKey(previous)]).toEqual(['saa-c03', archive]);
  expect(index.questions[questionKey(current)]).toEqual([
    'saa-c03',
    'courses/saa-c03/mock-questions.json',
  ]);
  const notes: Record<string, string[]> = clarifications;
  expect(notes[questionKey(previous)]).toEqual(['archivedCognitoAdaptiveMfaClarification']);
  expect(notes[questionKey(current)]).toBeUndefined();
  for (const localeMessages of Object.values(messages))
    expect(localeMessages.archivedCognitoAdaptiveMfaClarification).toBeTruthy();
});
