import { expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

const objectRows = [
  { caption: 'Diagnostic copy' },
  { caption: 'Visible copy' },
  { caption: 42, debug: { caption: 'Hidden copy' } },
];
const primitiveRows = [0, 'First copy', false, 'Second copy'];
const copies = ['Diagnostic copy', 'Visible copy', 'Hidden copy', 'First copy', 'Second copy'];

type OracleCase = { name: string; source: string; render: () => unknown };

function fixture(rows: unknown[], expression: string) {
  return `const rows=${JSON.stringify(rows)}; const result=${expression}; export const View=()=> <p>{result}</p>;`;
}

function displayed(value: unknown) {
  const html = renderToStaticMarkup(createElement('p', null, value as ReactNode));
  return new Set(copies.filter((copy) => html.includes(copy)));
}

const cases: OracleCase[] = [
  {
    name: 'map caption',
    source: fixture(objectRows, 'rows.map((row)=>row.caption)'),
    render: () => objectRows.map((row) => row.caption),
  },
  {
    name: 'slice selected map',
    source: fixture(objectRows, 'rows.slice(1,2).map((row)=>row.caption)'),
    render: () => objectRows.slice(1, 2).map((row) => row.caption),
  },
  {
    name: 'slice empty map',
    source: fixture(objectRows, 'rows.slice(0,0).map((row)=>row.caption)'),
    render: () => objectRows.slice(0, 0).map((row) => row.caption),
  },
  {
    name: 'filter boolean join',
    source: fixture(primitiveRows, "rows.filter(Boolean).join('')"),
    render: () => primitiveRows.filter(Boolean).join(''),
  },
  {
    name: 'slice primitive direct',
    source: fixture(primitiveRows, 'rows.slice(1,2)'),
    render: () => primitiveRows.slice(1, 2),
  },
  {
    name: 'map constant slice filter join',
    source: fixture(primitiveRows, "rows.map(()=>'Visible copy').slice(0,1).filter(Boolean).join('')"),
    render: () =>
      primitiveRows
        .map(() => 'Visible copy')
        .slice(0, 1)
        .filter(Boolean)
        .join(''),
  },
  {
    name: 'map index',
    source: fixture(objectRows, 'rows.map((row)=>row.caption)[1]'),
    render: () => objectRows.map((row) => row.caption)[1],
  },
  {
    name: 'fixed object index',
    source: fixture(objectRows, 'rows[1].caption'),
    render: () => objectRows[1].caption,
  },
  {
    name: 'nested slice selected',
    source: fixture(objectRows, 'rows.slice(1,3).slice(1).map((row)=>row.caption)'),
    render: () =>
      objectRows
        .slice(1, 3)
        .slice(1)
        .map((row) => row.caption),
  },
  {
    name: 'nested slice empty',
    source: fixture(objectRows, 'rows.slice(1).slice(1,2).map((row)=>row.caption)'),
    render: () =>
      objectRows
        .slice(1)
        .slice(1, 2)
        .map((row) => row.caption),
  },
  {
    name: 'join after selected map',
    source: fixture(objectRows, "rows.slice(1,2).map((row)=>row.caption).join('')"),
    render: () =>
      objectRows
        .slice(1, 2)
        .map((row) => row.caption)
        .join(''),
  },
  {
    name: 'selected index after filter',
    source: fixture(primitiveRows, 'rows.filter(Boolean)[1]'),
    render: () => primitiveRows.filter(Boolean)[1],
  },
  {
    name: 'zero selected range',
    source: fixture(primitiveRows, "rows.slice(0,0).join('')"),
    render: () => primitiveRows.slice(0, 0).join(''),
  },
];

test('selector findings equal literals rendered by native JS and React', () => {
  const failures: string[] = [];
  for (const scenario of cases) {
    const source = createSource('/virtual/selector-render-oracle.tsx', scenario.source);
    const findings = checkSources([source], '/virtual');
    const actual = new Set(findings.map((finding) => finding.text));
    try {
      expect(actual).toEqual(displayed(scenario.render()));
    } catch {
      failures.push(scenario.name);
    }
  }
  expect(failures).toEqual([]);
});
