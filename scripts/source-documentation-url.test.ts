import { expect, test } from 'bun:test';
import { officialGuideLink } from '../src/certificationGuides';
import type { FundamentalsContent } from '../src/fundamentals/types';
import japanese from '../src/source-url-aliases.ja.json' with { type: 'json' };
import aliases from '../src/source-url-aliases.json' with { type: 'json' };
import { localizedDocumentationSource, sourceDocumentationUrl } from '../src/sourceDocumentationUrl';
import type { CheckpointDocument } from './fundamentals-delivery/source';

test('source URL aliases are exact HTTPS destinations without chains or cycles', () => {
  expect(Object.keys(aliases)).toHaveLength(8);
  for (const [source, destination] of Object.entries(aliases)) {
    expect(source.startsWith('https://')).toBe(true);
    expect(destination.startsWith('https://')).toBe(true);
    expect(aliases[destination as keyof typeof aliases]).toBeUndefined();
    expect(destination).not.toBe(source);
  }
});

test('only own known aliases are applied', () => {
  const original = Object.keys(aliases)[0];
  expect(sourceDocumentationUrl(original)).toBe(aliases[original as keyof typeof aliases]);
  expect(sourceDocumentationUrl('https://example.com/unknown')).toBe('https://example.com/unknown');
  expect(sourceDocumentationUrl('toString')).toBe('toString');
});

test('verified Japanese AWS references use the actual Japanese destination and a clear Japanese label', () => {
  for (const [url, expected] of Object.entries(japanese)) {
    const shown = localizedDocumentationSource({ url, label: 'Original source' }, 'ja');
    expect(shown).toEqual({ ...expected, locale: 'ja' });
    expect(new URL(shown.url).pathname).toMatch(/^\/(?:ja_jp|jp)\//);
    expect(shown.label).toMatch(/[ぁ-んァ-ン一-龯]/);
    expect(localizedDocumentationSource({ url, label: 'Original source' }, 'de')).toEqual({
      url: sourceDocumentationUrl(url),
      label: 'Original source',
      locale: undefined,
    });
  }
  expect(localizedDocumentationSource({ url: 'toString', label: 'Original source' }, 'ja')).toEqual({
    url: 'toString',
    label: 'Original source',
    locale: undefined,
  });
});

test('AWS references in the current fundamentals material have verified Japanese sources', async () => {
  const content: FundamentalsContent = await Bun.file('public/fundamentals/content.json').json();
  const checkpointData: CheckpointDocument = await Bun.file(
    'public/fundamentals/checkpoints.json',
  ).json();
  const sources = [
    ...content.units.flatMap((unit) => [
      ...unit.sections.map(({ source }) => source),
      ...unit.questions.map(({ source }) => source),
    ]),
    ...checkpointData.units.flatMap((unit) => unit.checkpoints.map(({ source }) => source)),
  ];
  const official = new Set(['aws.amazon.com', 'docs.aws.amazon.com']);
  for (const source of sources.filter(({ url }) => official.has(new URL(url).hostname))) {
    expect(localizedDocumentationSource(source, 'ja').locale, source.url).toBe('ja');
  }
});

test('guide link corrects the English MLA guide and retains live localized paths and languages', () => {
  const english = officialGuideLink('machine-learning-engineer-associate-01', 'en');
  expect(english.language).toBe('en');
  expect(english.href).toBe(
    aliases[
      'https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01.html'
    ],
  );

  const japanese = officialGuideLink('machine-learning-engineer-associate-01', 'ja');
  expect(japanese.language).toBe('ja');
  expect(japanese.href).toContain('/ja_jp/aws-certification/latest/');
});
