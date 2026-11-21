import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(text: string) {
  return checkSources([createSource('/fixture/View.tsx', text)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('keeps the source slice before Boolean filtering object members', () => {
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'Visible copy'}];
      export const View=()=> <p>{rows.slice(1).filter(Boolean)[0].caption}</p>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(`const first={caption:'Diagnostic copy'};const second={caption:'Visible copy'};const rows=[first,second];
      export const View=()=> <p>{rows.slice(1).filter(Boolean)[0].caption}</p>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(`const rows=[...[{caption:'Diagnostic copy'},{caption:'Visible copy'}]];
      export const View=()=> <p>{rows.slice(1).filter(Boolean)[0].caption}</p>;`),
  ).toEqual(['Visible copy']);
});

test('filters mapped member output without filtering truthy input objects', () => {
  expect(
    scan(`const rows=[{caption:0},{caption:'Visible copy'}];
      export const View=()=> <p>{rows.map((row)=>row.caption).filter(Boolean)[0]}</p>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(
      `export const View=({possible}:{possible:unknown})=> <p>{[{caption:possible},{caption:'Visible copy'}].map((row)=>row.caption).filter(Boolean)[0]}</p>;`,
    ),
  ).toEqual(['Visible copy']);
});

test('uses the final known object member and defers spread members', () => {
  expect(
    scan(
      `export const View=()=> <p>{[{caption:0,caption:'Visible copy'}].map((row)=>row.caption).filter(Boolean)[0]}</p>;`,
    ),
  ).toEqual(['Visible copy']);
  expect(
    scan(
      `export const View=()=> <p>{[{caption:0,...{caption:'Visible copy'}}].map((row)=>row.caption).filter(Boolean)[0]}</p>;`,
    ),
  ).toEqual(['Visible copy']);
});
