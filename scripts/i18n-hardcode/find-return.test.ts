import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('find returns an object element whose optional member remains visible text', () => {
  expect(
    scan(`const items=[{caption:'Please sign in'}];
    export const View=()=> <p>{items.find(()=>true)?.caption}</p>`),
  ).toEqual(['Please sign in']);
});

test('find returns primitive element values directly', () => {
  expect(
    scan(`const items=['Please sign in'];
    export const View=()=> <p>{items.find(()=>true)}</p>`),
  ).toEqual(['Please sign in']);
});

test('find preserves nested member paths after assigning its result', () => {
  expect(
    scan(`const items=[{content:{caption:'Please sign in'}}];const found=items.find(()=>true);
    export const View=()=> <p>{found?.content.caption}</p>`),
  ).toEqual(['Please sign in']);
});

test('find accepts translated object members and primitive values', () => {
  expect(
    scan(`import {usePreferences} from './preferences';
    export function View(){const {t}=usePreferences();
      const objects=[{caption:t('save')}];const primitives=[t('save')];
      return <><p>{objects.find(()=>true)?.caption}</p><p>{primitives.find(()=>true)}</p></>}`),
  ).toEqual([]);
});

test('find used only for diagnostics does not create a visible text violation', () => {
  expect(
    scan(`const items=[{caption:'Protocol diagnostic'}];const found=items.find(()=>true);
    export const View=()=> <p>{42}</p>`),
  ).toEqual([]);
});

test('filter and slice continue returning arrays rather than single elements', () => {
  for (const method of ['filter(()=>true)', 'slice(0)']) {
    expect(
      scan(`const items=[{caption:'Please sign in'}];
      export const View=()=> <p>{items.${method}[0].caption}</p>`),
    ).toEqual(['Please sign in']);
  }
});
