import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/src/View.tsx', code)], '/fixture');
}

test('does not coerce arrays, functions, or framework containers into scalar sink names', () => {
  expect(
    scan(`
      element.setAttribute(['aria-label','ledby'], 'Array heading ID');
      element.setAttribute(()=> 'aria-label', 'Function heading ID');
      const callable = function(){return 'aria-label'};
      element.setAttribute(callable, 'Named function heading ID');
      element.setAttribute(useCallback(()=> 'aria-label',[]), 'Callback heading ID');
      element.setAttribute(useState('aria-label'), 'State heading ID');
      element.setAttribute([1].map(()=> 'aria-label'), 'Mapped heading ID');
      const nested = ()=> ()=> 'aria-label';
      element.setAttribute(nested(), 'Nested function heading ID');
    `),
  ).toEqual([]);
});

test('resolves actual helper returns and explicit array elements as scalar names', () => {
  expect(
    scan(`
      const fields = ['aria-label','aria-valuetext'];
      const helper = (name) => name;
      const object = () => ({name:'aria-description'});
      element.setAttribute(fields[0], 'Close dialog');
      element.setAttribute(helper('aria-'+'valuetext'), 'Half complete');
      element.setAttribute(object().name, 'Dialog description');
      element.setAttribute((()=> 'aria-label')(), 'Inline helper');
    `).map((finding) => finding.text),
  ).toEqual(['Close dialog', 'Half complete', 'Dialog description', 'Inline helper']);
});

test('keeps ordinary visible origins and array rendering unchanged', () => {
  const findings = scan(`
    const words=['Hello ','there'];
    const view=()=> <p>{words.map(word=>word)}{'Visible '+'text'}</p>;
  `);
  expect(findings.map((finding) => finding.text)).toEqual(['Hello', 'there', 'Visible', 'text']);
});
