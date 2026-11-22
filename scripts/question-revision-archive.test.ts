import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyCourses } from '../src/certifications';
import clarifications from '../src/question-clarifications.json';
import { parseQuestions, questionKey } from '../src/questions';
import { naturalQuestionHash, questionTranslationSource } from './natural-translation-content';

const path = 'courses/sap-c03/archive-2026-11-21.json';
const id = 'sap-c03-full-arch-018';
const read = (file: string) => parseQuestions(JSON.parse(readFileSync(`public/${file}`, 'utf8')));

test('a changed firewall premise gets a new revision while existing session references stay resolvable', () => {
  const previous = read(path)[0];
  const current = read('courses/sap-c03/mock-2026-11.json').find((question) => question.id === id);
  assert(current, 'Current question revision is missing');
  expect(current.revision).toBe(2);
  expect(previous.id).toBe(id);
  expect(previous.revision).toBe(1);
  expect(current.correct).toEqual(previous.correct);
  expect(studyCourses.find((course) => course.id === 'sap-c03')?.course?.archives).toContain(path);
  const index = JSON.parse(readFileSync('public/learning-question-index.v1.json', 'utf8'));
  expect(index.questions[questionKey(previous)]).toEqual(['sap-c03', path]);
  expect(index.questions[questionKey(current)]).toEqual([
    'sap-c03',
    'courses/sap-c03/mock-2026-11.json',
  ]);
  expect(
    naturalQuestionHash({
      ...previous,
      categoryLabel: previous.category,
      examDomainLabel: previous.examDomain ?? previous.category,
      versionLabel: previous.version,
      sourceLabel: previous.source.label,
    }),
  ).toBe('647feddf90312179ffe80a2cbf57b745d988e7c8136144128658a8d2ac3fcec3');
  const notes: Record<string, string[]> = clarifications;
  expect(notes[questionKey(previous)]).toEqual(['archivedFirewallScopeClarification']);
  expect(notes[questionKey(current)]).toBeUndefined();
});

test('backup policy prerequisites use revision 2 while historical B/E answers keep their original meaning', () => {
  const archive = 'courses/aip-c01/archive-2026-11-22.json';
  const questionId = 'aip-c01-d3-067';
  const previous = read(archive).find((question) => question.id === questionId);
  const current = read('courses/aip-c01/full-mock-2026-11.json').find(
    (question) => question.id === questionId,
  );
  assert(previous && current);
  expect(previous.revision).toBe(1);
  expect(current.revision).toBe(2);
  expect(current.correct).toEqual(['B', 'E']);
  expect(previous.correct).toEqual(['B', 'E']);
  expect(previous.choices.find((choice) => choice.id === 'B')?.text).toContain('信頼されたアクセス');
  expect(current.choices.find((choice) => choice.id === 'B')?.text).toContain('ポリシータイプ');
  expect(naturalQuestionHash(questionTranslationSource(previous))).toBe(
    '7533d5c0b01a97ab50950e21d3d810833a4e9c29278d57434edd31efabbb4455',
  );
  expect(studyCourses.find((course) => course.id === 'aip-c01')?.course?.archives).toContain(archive);
  const index = JSON.parse(readFileSync('public/learning-question-index.v1.json', 'utf8'));
  expect(index.questions[questionKey(previous)]).toEqual(['aip-c01', archive]);
  expect(index.questions[questionKey(current)]).toEqual([
    'aip-c01',
    'courses/aip-c01/full-mock-2026-11.json',
  ]);
  const notes: Record<string, string[]> = clarifications;
  expect(notes[questionKey(previous)]).toEqual(['archivedBackupPolicyPrerequisitesClarification']);
  expect(notes[questionKey(current)]).toBeUndefined();
});
