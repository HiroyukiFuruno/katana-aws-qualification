import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('concat ignores an appended value when a fixed receiver index is already occupied', () => {
  expect(scan(`export const View=()=> <p>{[42].concat('Diagnostic copy')[0]}</p>`)).toEqual([]);
  expect(
    scan(`const parts=[42];export const View=()=> <p>{parts.concat('Diagnostic copy')[0]}</p>`),
  ).toEqual([]);
});

test('concat keeps visible additions and receiver values when their index can resolve to them', () => {
  expect(scan(`export const View=()=> <p>{[].concat('Visible copy')[0]}</p>`)).toEqual(['Visible copy']);
  expect(
    scan(
      `export const View=()=> <p>{[{caption:'Receiver copy'}].concat({caption:'Diagnostic copy'})[0].caption}</p>`,
    ),
  ).toEqual(['Receiver copy']);
  expect(
    scan(`const parts=[42];parts.pop();export const View=()=> <p>{parts.concat('Visible copy')[0]}</p>`),
  ).toEqual(['Visible copy']);
});

test('concat preserves candidates from potentially spreadable object literals', () => {
  expect(
    scan(
      "export const View=()=> <p>{[].concat({0:'Visible copy',length:1,[Symbol.isConcatSpreadable]:true})[0]}</p>;",
    ),
  ).toEqual(['Visible copy']);
});
