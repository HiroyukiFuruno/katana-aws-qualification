import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyCourses } from '../src/certifications';
import { messages } from '../src/messages';
import clarifications from '../src/question-clarifications.json';
import sourceLocales from '../src/question-source-locales.json';
import { parseQuestions, questionKey } from '../src/questions';
import { additionalRevisionArchives } from './additional-revision-archive.fixture';
import { naturalQuestionHash } from './natural-translation-content';

const read = (path: string) => parseQuestions(JSON.parse(readFileSync(`public/${path}`, 'utf8')));

test('published premise revisions retain exact rev1 sources and separate rev2 index identities', () => {
  const notes: Record<string, string[]> = clarifications;
  const index = JSON.parse(readFileSync('public/learning-question-index.v1.json', 'utf8'));
  for (const migration of additionalRevisionArchives) {
    const previous = read(migration.archive).find((question) => question.id === migration.id);
    const current = read(migration.path.replace('public/', '')).find(
      (question) => question.id === migration.id,
    );
    assert(previous && current, `${migration.id}: migration sources are missing`);
    expect(previous.revision).toBe(1);
    expect(current.revision).toBe(2);
    expect(current.correct).toEqual(previous.correct);
    expect(naturalQuestionHash(previous)).toBe(migration.oldHash);
    expect(naturalQuestionHash(current)).toBe(migration.newHash);
    expect(notes[questionKey(previous)]).toEqual([migration.key]);
    expect(notes[questionKey(current)]).toBeUndefined();
    expect((sourceLocales as Record<string, string>)[migration.archive]).toBe('ja');
    expect(index.questions[questionKey(previous)]).toEqual([migration.certification, migration.archive]);
    expect(index.questions[questionKey(current)]).toEqual([migration.certification, migration.path]);
    const course = studyCourses.find(({ id }) => id === migration.certification)?.course;
    expect(course?.practice.map(({ path }) => path)).not.toContain(migration.archive);
    expect(course?.mock).not.toBe(migration.archive);
  }
  expect(studyCourses.find((course) => course.id === 'dva-c03')?.course?.archives).toContain(
    additionalRevisionArchives[0].archive,
  );
  expect(studyCourses.find((course) => course.id === 'sap-c03')?.course?.archives).toContain(
    additionalRevisionArchives[1].archive,
  );
  for (const localeMessages of Object.values(messages))
    for (const migration of additionalRevisionArchives)
      expect((localeMessages as Record<string, string>)[migration.key]).toBeTruthy();
});
