import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { loadQuestionBank } from '../src/questionLocalization';
import { questionTranslationSource } from '../src/questionTranslationSource';
import { canonical } from './question-localization-fixture';

const filename = 'courses/test/questions.json';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const translated = [
  {
    ...canonical[0],
    categoryLabel: 'Category',
    examDomainLabel: 'Domain',
    versionLabel: '2026',
    sourceLabel: 'AWS',
    title: 'Translated title',
    prompt: 'Translated prompt',
  },
];

function fixture({
  path = filename,
  sourceLocale = 'ja',
  translations = { en: { payloadHash: digest(translated) } },
  payload = translated,
  includePayload = true,
}: {
  path?: string;
  sourceLocale?: 'en' | 'ja';
  translations?: Record<string, { payloadHash: string }>;
  payload?: unknown;
  includePayload?: boolean;
} = {}) {
  const data = new Map<string, unknown>([
    [`/${path}`, canonical],
    [
      '/translations/published-content.v1.json',
      {
        schemaVersion: 1,
        banks: {
          [path]: {
            sourceLocale,
            sourceHash: digest(canonical.map(questionTranslationSource)),
            translations,
          },
        },
      },
    ],
    [`/translations/en/${path}`, payload],
    ['/translations/en/manifest.json', { [path]: digest(canonical.map(questionTranslationSource)) }],
    ['/translations/en/payload-manifest.json', { [path]: digest(translated) }],
  ]);
  const requests: string[] = [];
  if (!includePayload) data.delete(`/translations/en/${path}`);
  return {
    requests,
    fetch: (async (input: string | URL | Request) => {
      const request = String(input);
      requests.push(request);
      return data.has(request)
        ? new Response(JSON.stringify(data.get(request)))
        : new Response('', { status: 404 });
    }) as typeof fetch,
  };
}

test('a published translation requires matching contract, manifest, and payload hashes', async () => {
  const originalFetch = globalThis.fetch;
  const testFixture = fixture();
  globalThis.fetch = testFixture.fetch;
  try {
    const bank = await loadQuestionBank(filename, 'en');
    expect(bank.contentLocale).toBe('en');
    expect(bank.pendingLocale).toBeUndefined();
    expect(bank.questions[0].locale).toBe('en');
    expect(testFixture.requests).toEqual([
      `/${filename}`,
      '/translations/published-content.v1.json',
      `/translations/en/${filename}`,
      '/translations/en/manifest.json',
      '/translations/en/payload-manifest.json',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an explicit empty contract translates no target and serves the declared source', async () => {
  const originalFetch = globalThis.fetch;
  const testFixture = fixture({ translations: {} });
  globalThis.fetch = testFixture.fetch;
  try {
    const bank = await loadQuestionBank(filename, 'en');
    expect(bank).toMatchObject({ contentLocale: 'ja', pendingLocale: 'en' });
    expect(bank.questions[0].locale).toBe('ja');
    expect(testFixture.requests).toEqual([`/${filename}`, '/translations/published-content.v1.json']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a non-source target omitted from an otherwise translated bank is source-only', async () => {
  const originalFetch = globalThis.fetch;
  const testFixture = fixture({ translations: { de: { payloadHash: digest(translated) } } });
  globalThis.fetch = testFixture.fetch;
  try {
    await expect(loadQuestionBank(filename, 'en')).resolves.toMatchObject({
      contentLocale: 'ja',
      pendingLocale: 'en',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an authorized tampered translation blocks instead of becoming source-only', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fixture({ payload: [{ ...translated[0], prompt: 'tampered' }] }).fetch;
  try {
    await expect(loadQuestionBank(filename, 'en')).rejects.toThrow('invalidQuestionData');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an authorized missing translation blocks instead of becoming source-only', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fixture({ includePayload: false }).fetch;
  try {
    await expect(loadQuestionBank(filename, 'en')).rejects.toThrow('loadQuestionError');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an unlisted canonical path is invalid rather than implicitly source-only', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = String(input);
    if (path === `/${filename}`) return new Response(JSON.stringify(canonical));
    return new Response(JSON.stringify({ schemaVersion: 1, banks: {} }));
  }) as typeof fetch;
  try {
    await expect(loadQuestionBank(filename, 'en')).rejects.toThrow('invalidQuestionData');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
