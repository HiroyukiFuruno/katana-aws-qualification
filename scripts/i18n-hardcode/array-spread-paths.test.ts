import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string) {
  return checkSources([createSource('/fixture/View.tsx', code)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('keeps indexed paths through fixed-length, hole, nested, and multiple array spreads', () => {
  expect(
    scan(`const values=[{caption:'Prefix copy'},...[{caption:'Spread copy'}],{caption:'Suffix copy'}];
      const hole=[,{caption:'Hole copy'},...[{caption:'After hole copy'}]];
      const nested=[...[...[{caption:'Nested copy'}]],...[{caption:'Second spread copy'}]];
      export const View=()=> <p>{values[0].caption}{values[1].caption}{values[2].caption}{hole[1].caption}{hole[2].caption}{nested[0].caption}{nested[1].caption}</p>;`),
  ).toEqual([
    'Prefix copy',
    'Spread copy',
    'Suffix copy',
    'Hole copy',
    'After hole copy',
    'Nested copy',
    'Second spread copy',
  ]);
});

test('preserves suffix possibilities after unknown spreads and existing ArrayRest offsets', () => {
  expect(
    scan(`declare const unknownRows: unknown[];const values=[...unknownRows,{caption:'Unknown suffix copy'}];
      const [,{caption:direct},...tail]=[{caption:'Ignored copy'},...[{caption:'Array rest copy'}]];
      export const View=()=> <p>{values[0].caption}{direct}{tail[0].caption}</p>;`),
  ).toEqual(['Unknown suffix copy', 'Array rest copy']);
});

test('keeps translated and diagnostic spread values out of findings', () => {
  expect(
    scan(`import {usePreferences} from './preferences';function View(){const {t}=usePreferences();
      const values=[...[{caption:t('save')}],{caption:'Visible copy'}];
      const diagnostic=[...['Diagnostic copy']];return <p>{values[0].caption}{values[1].caption}{diagnostic.length}</p>;}`),
  ).toEqual(['Visible copy']);
});

test('keeps the selected alias-spread index and bounds fixed spreads after an unknown prefix', () => {
  expect(
    scan(`const rows=[{caption:'Visible alias copy'},{caption:'Diagnostic alias copy'}];
      const values=[{caption:'Prefix copy'},...rows];
      const [,...tail]=[{caption:'Ignored copy'},...rows];
      declare const unknownRows: unknown[];
      const bounded=[...unknownRows,...[{caption:'Reachable copy'},{caption:'Unreachable copy'}]];
      export const View=()=> <p>{values[1].caption}{tail[0].caption}{bounded[0].caption}</p>;`),
  ).toEqual(['Visible alias copy', 'Reachable copy']);
});
