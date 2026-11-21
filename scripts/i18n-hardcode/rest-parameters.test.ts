import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(text: string) {
  return checkSources([createSource('/fixture/View.tsx', text)], '/fixture').map(
    (finding) => finding.text,
  );
}

test('binds every residual argument to named rest callbacks without leaking diagnostics', () => {
  expect(
    scan(`
      const tail=(...parts:string[])=>parts[1];
      const afterHead=(head:string,...parts:string[])=>parts[1];
      const afterSpreadHead=(head:string,...parts:string[])=>parts[0];
      const spread=['Ignored spread','Spread copy'];
      const fixedSpread=['Head','Fixed spread copy'];
      const Card=({label}:{label:string})=><p>{label}</p>;
      const render=(item:{caption:string})=><Card label={afterHead('Head','Ignored map',item.caption)}/>;
      const diagnostic=[{caption:'Diagnostic copy'}].map(render);
      export const View=()=> <><p>{tail('Ignored tail','Tail copy')}</p><p>{tail(...spread)}</p><p>{afterSpreadHead(...fixedSpread)}</p><p>{tail()}</p>{[{caption:'Mapped copy'}].map(render)}</>;
    `).sort(),
  ).toEqual(['Fixed spread copy', 'Mapped copy', 'Spread copy', 'Tail copy']);
});

test('keeps offsets, map elements, and nested rest call contexts distinct', () => {
  expect(
    scan(`
      const second=(head:string,...parts:string[])=>parts[1];
      const label=(...parts:string[])=>parts[0];
      const render=(...items:{caption:string}[])=><p>{items[0].caption}</p>;
      const diagnostic=[{caption:'Diagnostic copy'}].map(render);
      export const View=()=> <><p>{second('Head',...['Ignored'],...['Multiple spread copy'])}</p><p>{label(label('Nested rest copy'))}</p>{[{caption:'Mapped rest copy'}].map(render)}</>;
    `).sort(),
  ).toEqual(['Mapped rest copy', 'Multiple spread copy', 'Nested rest copy']);
});

test('keeps every map element available to a rest callback', () => {
  expect(
    scan(`
      import {usePreferences} from './preferences';
      const {t}=usePreferences();
      const render=(...items:{caption:string}[])=><p>{items[0].caption}</p>;
      export const View=()=> <>{[{caption:t('Translated copy')},{caption:'Visible map copy'}].map(render)}</>;
    `),
  ).toEqual(['Visible map copy']);
});
