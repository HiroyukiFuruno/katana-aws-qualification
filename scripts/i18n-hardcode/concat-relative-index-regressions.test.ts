import { expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

const copies = ['Diagnostic copy', 'Visible copy', 'Alias visible copy'];

type Scenario = { name: string; code: string; value: () => unknown };

function findings(code: string) {
  return new Set(
    checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map((finding) => finding.text),
  );
}

function displayed(value: unknown) {
  const html = renderToStaticMarkup(createElement('p', null, value as ReactNode));
  return new Set(copies.filter((copy) => html.includes(copy)));
}

const scenarios: Scenario[] = [
  {
    name: 'array argument uses its relative fixed index',
    code: "export const View=()=> <p>{[].concat(['Visible copy','Diagnostic copy'])[0]}</p>;",
    value: () => {
      const receiver: string[] = [];
      return receiver.concat(['Visible copy', 'Diagnostic copy'])[0];
    },
  },
  {
    name: 'receiver and preceding arguments offset the selected array index',
    code: "export const View=()=> <p>{[0].concat(['Diagnostic copy'],'Visible copy',['Diagnostic copy'])[2]}</p>;",
    value: () => {
      const receiver: (number | string)[] = [0];
      return receiver.concat(['Diagnostic copy'], 'Visible copy', ['Diagnostic copy'])[2];
    },
  },
  {
    name: 'remaining property selection stays within the selected array argument',
    code: "export const View=()=> <p>{[].concat([{caption:'Diagnostic copy'},{caption:'Visible copy'}])[1].caption}</p>;",
    value: () => {
      const receiver: { caption: string }[] = [];
      return receiver.concat([{ caption: 'Diagnostic copy' }, { caption: 'Visible copy' }])[1]?.caption;
    },
  },
  {
    name: 'single-use array aliases retain their known relative length',
    code: "const added=['Alias visible copy','Diagnostic copy'];export const View=()=> <p>{[].concat(added)[0]}</p>;",
    value: () => {
      const receiver: string[] = [];
      return receiver.concat(['Alias visible copy', 'Diagnostic copy'])[0];
    },
  },
  {
    name: 'array spreads keep unknown concat selections on the fallback path',
    code: "export const View=()=> <p>{[].concat([...[0,'Visible copy']])[1]}</p>;",
    value: () => {
      const receiver: (number | string)[] = [];
      return receiver.concat([...[0, 'Visible copy']])[1];
    },
  },
  {
    name: 'member arrays keep unknown concat selections on the fallback path',
    code: "const box={rows:[0,'Visible copy']};export const View=()=> <p>{[].concat(box.rows)[1]}</p>;",
    value: () => {
      const receiver: (number | string)[] = [];
      const box = { rows: [0, 'Visible copy'] };
      return receiver.concat(box.rows)[1];
    },
  },
];

test('concat findings equal bounded native JS and React output', () => {
  for (const scenario of scenarios) expect(findings(scenario.code)).toEqual(displayed(scenario.value()));
});
