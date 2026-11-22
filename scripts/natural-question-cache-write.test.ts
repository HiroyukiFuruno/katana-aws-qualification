import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeNaturalQuestionRecord } from './natural-question-cache-write';

test('concurrent cache writes publish one complete record with its review metadata', async () => {
  const directory = join('output/question-quality', `atomic-cache-${randomUUID()}`);
  const records = ['first', 'second'].map((model) => ({
    model,
    thread: `${model}-thread`,
    usage: null,
    locales: { en: { prompt: model.repeat(1000) } },
    reviewResolution: { evidence: `${model}-review` },
  }));
  await Promise.all(records.map((record) => writeNaturalQuestionRecord(directory, 'fixture', record)));
  const published = JSON.parse(await readFile(join(directory, 'fixture.json'), 'utf8'));
  expect(records).toContainEqual(published);
  expect(await readdir(directory)).toEqual(['fixture.json']);
});
