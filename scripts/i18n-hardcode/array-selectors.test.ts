import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(text: string) {
  return checkSources([createSource('/fixture/View.tsx', text)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('keeps known slice offsets and bounds without tracing excluded copy', () => {
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'Visible copy'}];
      export const View=()=> <p>{rows.slice(1)[0].caption}{rows.slice(1,1)[0]?.caption}</p>;`),
  ).toEqual(['Visible copy']);
});

test('selects Boolean-filter candidates instead of their source indexes', () => {
  expect(
    scan(`const rows=[0,{caption:'Please sign in'}];
      export const View=()=> <p>{rows.filter(Boolean)[0].caption}</p>;`),
  ).toEqual(['Please sign in']);
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},0,{caption:'Visible copy'}];
      export const View=()=> <p>{rows.filter(Boolean)[1].caption}</p>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(`import {usePreferences} from './preferences';const {t}=usePreferences();
      const rows=[0,{caption:t('Translated copy')},{caption:'Visible copy'}];
      export const View=()=> <p>{rows.filter(Boolean)[1].caption}</p>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(`const rows=[{caption:'Hidden copy'}];
      export const View=()=> <p>{rows.filter(()=>false)[0]?.caption}</p>;`),
  ).toEqual([]);
});

test('preserves slice range offsets through map, nested slices, and rest aliases', () => {
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'First copy'},{caption:'Second copy'}];
      const [, ...tail]=rows;const render=(row:typeof rows[number])=><p>{row.caption}</p>;
      export const View=()=> <>{rows.slice(1,3)[1].caption}{rows.slice(1).map(render)}{rows.slice(1).slice(1)[0].caption}{tail.slice(1)[0].caption}</>;`),
  ).toEqual(['First copy', 'Second copy']);
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'First copy'},{caption:'Second copy'}];
      const render=(row:typeof rows[number])=><p>{row.caption}</p>;
      export const View=()=> <>{rows.slice(1,2).map(render)}</>;`),
  ).toEqual(['First copy']);
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},...[{caption:'First spread copy'},{caption:'Second spread copy'}]];
      const render=(row:typeof rows[number])=><p>{row.caption}</p>;
      export const View=()=> <>{rows.slice(1,2).map(render)}</>;`),
  ).toEqual(['First spread copy']);
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'First copy'},{caption:'Second copy'},{caption:'Excluded copy'}];
      const render=(row:typeof rows[number])=><p>{row.caption}</p>;
      export const View=()=> <>{rows.slice(1,3).slice(0).map(render)}</>;`),
  ).toEqual(['First copy', 'Second copy']);
  expect(
    scan(`const rows=[{caption:'Diagnostic copy'},{caption:'First copy'},{caption:'Visible copy'},{caption:'Excluded copy'}];
      const render=(row:typeof rows[number])=><p>{row.caption}</p>;
      export const View=()=> <>{rows.slice(1).slice(1,2).map(render)}{rows.slice(1,3).slice(1).map(render)}</>;`),
  ).toEqual(['Visible copy']);
  expect(
    scan(`const rows=[{caption:'First candidate'},{caption:'Second candidate'}];const start=-1;
      export const View=()=> <p>{rows.slice(start)[0].caption}</p>;`),
  ).toEqual(['First candidate', 'Second candidate']);
});

test('keeps finite map selection through a state updater selector cycle', () => {
  expect(
    scan(`const initial=[{caption:'Diagnostic copy'},{caption:'Visible copy'}];
      export function View(){const [rows,setRows]=useState(initial);
      setRows((current)=>current.filter(Boolean).slice(1).map((item)=>item));
      return <p>{rows.map((item)=>item.caption)}</p>;}`),
  ).toEqual(['Diagnostic copy', 'Visible copy']);
});
