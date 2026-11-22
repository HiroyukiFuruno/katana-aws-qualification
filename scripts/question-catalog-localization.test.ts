import { expect, test } from 'bun:test';
import { questionPayloadHash } from '../src/questionPayloadIntegrity';
import { questionTranslationSource } from '../src/questionTranslationSource';
import { createLocalizedQuestionResolver } from '../src/progress/questionCatalog';

function question(id: string) {
  return {
    category: 'storage',
    choices: [
      { explanation: 'Explanation', id: 'a', text: 'A' },
      { explanation: 'Explanation', id: 'b', text: 'B' },
    ],
    correct: ['a'],
    id,
    prompt: 'Prompt',
    revision: 1,
    source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
    title: 'Title',
    version: '2026-11',
  };
}
const response = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value)));
const path = 'courses/saa-c03/questions.json';
async function publication(canonical: ReturnType<typeof question>, translated?: unknown) {
  const sourceHash = await questionPayloadHash([questionTranslationSource(canonical)]);
  const payloadHash = translated ? await questionPayloadHash([translated]) : undefined;
  return {
    sourceHash,
    payloadHash,
    contract: {
      schemaVersion: 1,
      banks: {
        [path]: {
          sourceLocale: 'ja',
          sourceHash,
          translations: payloadHash ? { en: { payloadHash } } : {},
        },
      },
    },
  };
}

test('uses a validated localized bank only for presentation', async () => {
  const canonical = question('question');
  const localized = {
    ...canonical,
    categoryLabel: 'Storage',
    examDomainLabel: 'Storage',
    sourceLabel: 'AWS Documentation',
    title: 'Localized title',
    versionLabel: 'Original practice 2026-11',
  };
  const published = await publication(canonical, localized);
  const resolver = createLocalizedQuestionResolver('en', (input) => {
    switch (String(input)) {
      case '/translations/published-content.v1.json':
        return response(published.contract);
      case '/translations/en/manifest.json':
        return response({ [path]: published.sourceHash });
      case '/translations/en/payload-manifest.json':
        return response({ [path]: published.payloadHash });
      case '/learning-question-index.v1.json':
        return response({
          schemaVersion: 1,
          questions: { '["question",1]': ['saa-c03', 'courses/saa-c03/questions.json'] },
        });
      case '/courses/saa-c03/questions.json':
        return response([canonical]);
      case '/translations/en/courses/saa-c03/questions.json':
        return response([localized]);
      default:
        throw new Error(`Unexpected request: ${input}`);
    }
  });
  await expect(resolver('question', 1)).resolves.toMatchObject({
    certificationId: 'saa-c03',
    question: { category: 'storage', categoryLabel: 'Storage', title: 'Localized title' },
  });
});

test('does not fall back to canonical questions when a locale bank is missing', async () => {
  const canonical = question('question');
  const published = await publication(canonical, canonical);
  const resolver = createLocalizedQuestionResolver('en', (input) => {
    if (String(input) === '/translations/published-content.v1.json') return response(published.contract);
    if (String(input) === '/translations/en/manifest.json')
      return response({ [path]: published.sourceHash });
    if (String(input) === '/translations/en/payload-manifest.json')
      return response({ [path]: published.payloadHash });
    if (String(input) === '/learning-question-index.v1.json')
      return response({
        schemaVersion: 1,
        questions: { '["question",1]': ['saa-c03', 'courses/saa-c03/questions.json'] },
      });
    if (String(input) === '/courses/saa-c03/questions.json') return response([question('question')]);
    if (String(input) === '/translations/en/courses/saa-c03/questions.json')
      return Promise.resolve(new Response(null, { status: 404 }));
    throw new Error(`Unexpected request: ${input}`);
  });
  await expect(resolver('question', 1)).rejects.toThrow('loadQuestionError');
});

test('declared source-only catalog content preserves identity without requesting an overlay', async () => {
  const canonical = question('question');
  const published = await publication(canonical);
  const requested: string[] = [];
  const resolver = createLocalizedQuestionResolver('en', (input) => {
    const url = String(input);
    requested.push(url);
    if (url === '/learning-question-index.v1.json')
      return response({
        schemaVersion: 1,
        questions: { '["question",1]': ['saa-c03', path] },
      });
    if (url === `/${path}`) return response([canonical]);
    if (url === '/translations/published-content.v1.json') return response(published.contract);
    throw new Error(`Unexpected request: ${url}`);
  });
  await expect(resolver('question', 1)).resolves.toMatchObject({
    certificationId: 'saa-c03',
    question: { id: 'question', revision: 1, locale: 'ja' },
  });
  expect(requested.some((url) => url.startsWith('/translations/en/'))).toBe(false);
});
