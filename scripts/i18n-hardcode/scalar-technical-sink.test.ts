import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/src/View.tsx', code)], '/fixture');
}

test('resolves technical identifier fields when they are scalar sink names', () => {
  expect(
    scan(`
      const base = {id: 'aria-description'};
      const attrs = {...base, code: 'aria-label', slug: 'aria-valuetext'};
      element.setAttribute(attrs.code, 'Close dialog');
      element.setAttribute(attrs['id'], 'Dialog description');
      element.setAttribute(attrs.slug, 'Half complete');
    `).map((finding) => finding.text),
  ).toEqual(['Close dialog', 'Dialog description', 'Half complete']);
});

test('keeps technical object values excluded from ordinary object tracing', () => {
  expect(
    scan(`
      const attrs = {code: 'visible-code', label: 'Enter a label'};
      const value = attrs.label;
      element.setAttribute('aria-label', value);
    `).map((finding) => finding.text),
  ).toEqual(['Enter a label']);
});

test('resolves technical scalar names through mapped callback values', () => {
  expect(
    scan(`
      const attrs = {code: 'aria-label'};
      element.setAttribute([attrs].map((row) => row.code)[0], 'Close dialog');
      element.setAttribute([0].map(() => 'aria-' + 'label')[0], 'Close dialog');
    `).map((finding) => finding.text),
  ).toEqual(['Close dialog', 'Close dialog']);
});
