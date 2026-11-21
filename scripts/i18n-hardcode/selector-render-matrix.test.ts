import { expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkSources } from './check.ts';
import {
  apply,
  copyLiterals,
  expression,
  inputs,
  operations,
  selections,
} from './selector-render-matrix-data.ts';
import { createSource } from './sources.ts';

function displayed(value: unknown) {
  const html = renderToStaticMarkup(createElement('p', null, value as ReactNode));
  return new Set(copyLiterals.filter((copy) => html.includes(copy)));
}

test('findings equal native JS and React output for bounded selector compositions', () => {
  const failures: string[] = [];
  let count = 0;
  for (const rows of inputs)
    for (const first of operations)
      for (const second of operations)
        for (const selection of selections) {
          count += 1;
          const source = `const rows=${JSON.stringify(rows)}; const result=${expression(first, second, selection)}; export const View=()=> <p>{result}</p>;`;
          const actual = new Set(
            checkSources([createSource('/virtual/selector-matrix.tsx', source)], '/virtual').map(
              (finding) => finding.text,
            ),
          );
          try {
            expect(actual).toEqual(
              displayed(
                selection
                  ? selection === ".join('')"
                    ? apply(first, second, rows).join('')
                    : apply(first, second, rows)[Number(selection[1])]
                  : apply(first, second, rows),
              ),
            );
          } catch {
            failures.push(`${rows.length}:${first.source}->${second.source}${selection}`);
          }
        }
  expect(count).toBe(432);
  expect(failures).toEqual([]);
});
