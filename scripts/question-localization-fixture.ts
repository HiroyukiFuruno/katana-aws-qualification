import type { Question } from '../src/questions';
import { questionTranslationSource } from '../src/questionTranslationSource';

export const canonical: Question[] = [
  {
    id: 'localized-question',
    revision: 1,
    category: 'カテゴリ',
    examDomain: 'domain',
    version: '2026',
    title: '日本語の題名',
    prompt: '日本語の設問',
    choices: ['A', 'B', 'C'].map((id) => ({ id, text: id, explanation: id })),
    correct: ['B'],
    source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
  },
];

import { createHash } from 'node:crypto';
import type { Locale } from '../src/locales';
import { sourceLocaleOf } from '../src/questionSourceLocale';

export function localizedQuestionFetch(filename: string, locale: Locale, translated: Question[]) {
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const root = `/translations/${locale}`;
  const sourceLocale = sourceLocaleOf(filename);
  const data = new Map<string, unknown>([
    [`/${filename}`, canonical],
    [
      '/translations/published-content.v1.json',
      {
        schemaVersion: 1,
        banks: {
          [filename]: {
            sourceLocale,
            sourceHash: hash(canonical.map(questionTranslationSource)),
            translations: { [locale]: { payloadHash: hash(translated) } },
          },
        },
      },
    ],
    [`${root}/${filename}`, translated],
    [`${root}/manifest.json`, { [filename]: hash(canonical.map(questionTranslationSource)) }],
    [`${root}/payload-manifest.json`, { [filename]: hash(translated) }],
  ]);
  const requests: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const path = String(input);
    requests.push(path);
    return data.has(path)
      ? new Response(JSON.stringify(data.get(path)))
      : new Response('', { status: 404 });
  }) as typeof globalThis.fetch;
  return { requests, fetch };
}
