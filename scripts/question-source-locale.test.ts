import { expect, test } from 'bun:test';
import { locales } from '../src/locales';
import { sourceLocaleOf, validateSourceLocaleDeclarations } from '../src/questionSourceLocale';

test('source locale declarations reject unknown languages instead of treating them as Japanese', () => {
  for (const value of ['english', '', null, undefined, 1])
    expect(() => validateSourceLocaleDeclarations({ 'courses/example.json': value })).toThrow(
      'Invalid question source locale: courses/example.json',
    );
  expect(() => validateSourceLocaleDeclarations({ used: 'ja', unused: 'english' })).toThrow(
    'Invalid question source locale: unused',
  );
});

test('declared supported languages and the existing undeclared Japanese default remain valid', () => {
  for (const locale of locales)
    expect(() => validateSourceLocaleDeclarations({ example: locale })).not.toThrow();
  expect(sourceLocaleOf('courses/mla-c02/mock-2026-11.json')).toBe('en');
  expect(sourceLocaleOf('courses/undeclared.json')).toBe('ja');
});
