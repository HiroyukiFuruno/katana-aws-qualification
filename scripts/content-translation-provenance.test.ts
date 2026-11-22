import { expect, test } from 'bun:test';
import {
  assertContentPayloadHash,
  contentPayloadHash,
  updateContentPayloadManifest,
} from './content-translation-provenance';

test('content payload hash binds the manifest to the exact published JSON value', () => {
  const published = {
    questions: [{ id: 'question-1', prompt: 'Original translation' }],
  };
  const hash = contentPayloadHash(published);

  expect(() => assertContentPayloadHash(published, hash, 'fixture')).not.toThrow();
  expect(() =>
    assertContentPayloadHash(
      { questions: [{ id: 'question-1', prompt: 'Tampered translation' }] },
      hash,
      'fixture',
    ),
  ).toThrow('published translation payload changed');
});

test('payload manifest updates one published path without changing completed paths', () => {
  const next = updateContentPayloadManifest(
    { 'courses/complete/questions.json': 'completed-hash' },
    'courses/ready/questions.json',
    [{ id: 'ready' }],
  );

  expect(next).toEqual({
    'courses/complete/questions.json': 'completed-hash',
    'courses/ready/questions.json': contentPayloadHash([{ id: 'ready' }]),
  });
});
