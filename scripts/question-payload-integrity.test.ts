import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { questionPayloadHash, verifyQuestionPayloads } from '../src/questionPayloadIntegrity';
import { canonical } from './question-localization-fixture';

const filename = 'courses/fixture/questions.json';
const source = [{ ...canonical[0], prompt: 'Original conditions' }];
const translated = [{ id: 'same', revision: 1, prompt: 'Translated conditions' }];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceManifest = {
  [filename]: hash(
    source.map((question) => ({
      ...question,
      categoryLabel: 'カテゴリ',
      examDomainLabel: 'domain',
      versionLabel: '2026',
      sourceLabel: 'AWS',
    })),
  ),
};
const payloadManifest = { [filename]: hash(translated) };

test('browser payload hashes match the publish-time SHA-256 contract', async () => {
  expect(await questionPayloadHash(source)).toBe(hash(source));
  await expect(
    verifyQuestionPayloads(filename, source, translated, sourceManifest, payloadManifest),
  ).resolves.toBeUndefined();
});

test('mixed source versions and changed translation conditions fail even with unchanged grading IDs', async () => {
  await expect(
    verifyQuestionPayloads(
      filename,
      [{ ...source[0], prompt: 'Revised conditions' }],
      translated,
      sourceManifest,
      payloadManifest,
    ),
  ).rejects.toThrow('invalidQuestionData');
  await expect(
    verifyQuestionPayloads(
      filename,
      source,
      [{ ...translated[0], prompt: 'The condition does not apply.' }],
      sourceManifest,
      payloadManifest,
    ),
  ).rejects.toThrow('invalidQuestionData');
});

test('missing, malformed, or inherited manifest entries cannot bypass payload verification', async () => {
  for (const manifest of [{}, null, [], { [filename]: 'bad' }, Object.create(payloadManifest)])
    await expect(
      verifyQuestionPayloads(filename, source, translated, sourceManifest, manifest),
    ).rejects.toThrow('invalidQuestionData');
});

test('a real published source manifest uses the same display-label expansion in the browser', async () => {
  const path = 'courses/dva-c02/questions.json';
  const original = JSON.parse(await readFile(`public/${path}`, 'utf8'));
  const localized = JSON.parse(await readFile(`public/translations/en/${path}`, 'utf8'));
  const manifest = JSON.parse(await readFile('public/translations/en/manifest.json', 'utf8'));
  expect(hash(original)).not.toBe(manifest[path]);
  await expect(
    verifyQuestionPayloads(path, original, localized, manifest, { [path]: hash(localized) }),
  ).resolves.toBeUndefined();
});
