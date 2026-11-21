import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(text: string) {
  return checkSources([createSource('/fixture/View.ts', text)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('stops recursive scalar call targets while retaining finite selector results', () => {
  expect(
    scan(`
      function again(){return again().value;}
      function left(){return right().value;}
      function right(){return left().value;}
      const attribute=()=> 'aria-label';
      const select=()=>attribute();
      function withBase(){return true ? 'aria-description' : withBase().value;}
      element.setAttribute(again(), 'Self copy');
      element.setAttribute(left(), 'Mutual copy');
      element.setAttribute(select(), 'Nested copy');
      element.setAttribute(withBase(), 'Base copy');
    `),
  ).toEqual(['Nested copy', 'Base copy']);
});
