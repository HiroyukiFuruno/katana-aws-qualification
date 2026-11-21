import { expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkSources } from './check.ts';
import {
  copyLiterals,
  type ObjectRow,
  objectInputs,
  operationsFor,
  type Primitive,
  selectionsA,
  selectionsB,
} from './selector-object-matrix-data.ts';
import { createSource } from './sources.ts';

const displayed = (value: unknown) => {
  const html = renderToStaticMarkup(createElement('p', null, value as ReactNode));
  return new Set(copyLiterals.filter((copy) => html.includes(copy)));
};
const findings = (source: string) =>
  new Set(
    checkSources([createSource('/virtual/selector-object-matrix.tsx', source)], '/virtual').map(
      (f) => f.text,
    ),
  );
const recordMismatch = (
  failures: string[],
  rows: unknown,
  first: number,
  second: number,
  selection: string,
  source: string,
  expected: Set<string>,
  actual: Set<string>,
) => {
  if (JSON.stringify([...actual]) !== JSON.stringify([...expected]))
    failures.push(
      JSON.stringify({
        rows,
        first,
        second,
        selection,
        source,
        expected: [...expected],
        actual: [...actual],
      }),
    );
};

test('object selectors match native JS and React output', () => {
  const failures: string[] = [];
  let count = 0;
  const operations = operationsFor<ObjectRow>();
  for (const rows of objectInputs)
    for (const first of operations)
      for (const second of operations)
        for (const selection of selectionsA) {
          count += 1;
          const source = `const rows=${JSON.stringify(rows)}; const result=${second.source(first.source('rows'))}${selection}; export const View=()=> <p>{result}</p>;`;
          const secondValue = second.apply(first.apply(rows));
          const selected =
            selection === '[0]?.caption'
              ? secondValue[0]?.caption
              : selection === '[1]?.caption'
                ? secondValue[1]?.caption
                : secondValue.map((row) => row.caption);
          const actual = findings(source);
          const expected = displayed(selected);
          recordMismatch(
            failures,
            rows,
            operations.indexOf(first),
            operations.indexOf(second),
            selection,
            source,
            expected,
            actual,
          );
        }
  expect(count).toBe(225);
  expect(failures).toEqual([]);
});

test('object map-to-caption selectors match native JS and React output', () => {
  const failures: string[] = [];
  let count = 0;
  const operations = operationsFor<Primitive>();
  for (const rows of objectInputs)
    for (const first of operations)
      for (const second of operations)
        for (const selection of selectionsB) {
          count += 1;
          const source = `const rows=${JSON.stringify(rows)}; const mapped=rows.map((row)=>row.caption); const result=${selection === 'direct' ? second.source(first.source('mapped')) : `${second.source(first.source('mapped'))}${selection}`}; export const View=()=> <p>{result}</p>;`;
          const mapped = rows.map((row) => row.caption);
          const secondValue = second.apply(first.apply(mapped));
          const selected =
            selection === 'direct'
              ? secondValue
              : selection === ".join('')"
                ? secondValue.join('')
                : secondValue[Number(selection[1])];
          const actual = findings(source);
          const expected = displayed(selected);
          recordMismatch(
            failures,
            rows,
            operations.indexOf(first),
            operations.indexOf(second),
            selection,
            source,
            expected,
            actual,
          );
        }
  expect(count).toBe(300);
  expect(failures).toEqual([]);
});
