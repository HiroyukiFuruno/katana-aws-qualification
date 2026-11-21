import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map(
    (finding) => finding.text,
  );
}

for (const selection of [".join('')", '[0]', '.find(() => true)']) {
  test(`mapped strings remain visible after ${selection}`, () => {
    expect(scan(`const View=()=> <p>{[0].map(() => 'Please sign in')${selection}}</p>`)).toEqual([
      'Please sign in',
    ]);
  });
}

test('mapped object selection preserves the remaining member path', () => {
  expect(
    scan(
      `const View=()=> <p>{[0].map(() => ({content:{caption:'Please sign in'}}))[0].content.caption}</p>`,
    ),
  ).toEqual(['Please sign in']);
});

test('flat mapped array and scalar values remain visible after selection', () => {
  for (const result of ["['Please sign in']", "'Please sign in'"]) {
    expect(scan(`const View=()=> <p>{[0].flatMap(() => ${result}).join('')}</p>`)).toEqual([
      'Please sign in',
    ]);
  }
});

test('JSX spread children match explicitly supplied children', () => {
  for (const props of ["children='Please sign in'", "{...{children:'Please sign in'}}"]) {
    expect(scan(`const View=()=> <p ${props}/>`)).toEqual(['Please sign in']);
  }
});

test('unused mapped copy and translated spread children are accepted', () => {
  expect(
    scan(`const values=[0].map(() => 'Diagnostic copy');const View=()=> <p>{values.length}</p>`),
  ).toEqual([]);
  expect(
    scan(
      `import {usePreferences} from './preferences';function View(){const {t}=usePreferences();return <p {...{children:t('save')}}/>}`,
    ),
  ).toEqual([]);
});

test('flatMap never flattens object properties into rendered member paths', () => {
  expect(
    scan(`const rows=[0].flatMap(() => ({caption:42,debug:{caption:'Diagnostic copy'}}));
    const View=()=> <p>{rows[0].caption}</p>`),
  ).toEqual([]);
  expect(
    scan(`const row={caption:'Visible copy',debug:{caption:'Diagnostic copy'}};
    const rows=[0].flatMap(() => [row]);const View=()=> <p>{rows[0].caption}</p>`),
  ).toEqual(['Visible copy']);
});

test('flatMap follows array selectors through mapped arrays and array preserving calls', () => {
  for (const suffix of ['', '.filter(() => true)', '.slice(0)']) {
    expect(
      scan(`const rows=[0].flatMap(() => [0].map(() => ({caption:'Please sign in'}))${suffix});
      const View=()=> <p>{rows[0].caption}</p>`),
    ).toEqual(['Please sign in']);
  }
  expect(
    scan(`const rows=[0].flatMap(() => [0].flatMap(() => [{caption:'Please sign in'}]));
    const View=()=> <p>{rows[0].caption}</p>`),
  ).toEqual(['Please sign in']);
});
