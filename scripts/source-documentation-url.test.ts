import { expect, test } from 'bun:test';
import { officialGuideLink } from '../src/certificationGuides';
import aliases from '../src/source-url-aliases.json' with { type: 'json' };
import { sourceDocumentationUrl } from '../src/sourceDocumentationUrl';

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
