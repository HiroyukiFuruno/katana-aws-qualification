import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

type Mode = 'visible' | 'translated' | 'hidden';

function scan(files: Record<string, string>) {
  return checkSources(
    Object.entries(files).map(([path, text]) => createSource(`/fixture/${path}`, text)),
    '/fixture',
  ).map((finding) => finding.text);
}

function view(mode: Mode, render = 'render') {
  const content = mode === 'visible' ? `<p>{items.map(${render})}</p>` : `<p>{items.map(${render})}</p>`;
  return mode === 'hidden'
    ? `const diagnostic=items.map(${render});export const View=()=> <p>{42}</p>`
    : `export const View=()=> ${content}`;
}

for (const kind of ['const', 'function'] as const)
  for (const mode of ['visible', 'translated', 'hidden'] as const)
    test(`local named ${kind} map callback is ${mode}`, () => {
      const translated = mode === 'translated';
      const declaration =
        kind === 'const'
          ? `const render=(item:{caption:string})=>${translated ? 't(item.caption)' : 'item.caption'};`
          : `function render(item:{caption:string}){return ${translated ? 't(item.caption)' : 'item.caption'}}`;
      const setup = translated
        ? `import {usePreferences} from './preferences';const {t}=usePreferences();`
        : '';
      expect(
        scan({
          'View.tsx': `${setup}const items=[{caption:'Please sign in'}];${declaration}${view(mode)}`,
        }),
      ).toEqual(mode === 'visible' ? ['Please sign in'] : []);
    });

for (const mode of ['visible', 'translated', 'hidden'] as const)
  test(`named reexport map callback is ${mode}`, () => {
    const translated = mode === 'translated';
    expect(
      scan({
        'View.tsx': `import {render} from './barrel';const items=[{caption:'Please sign in'}];${view(mode)}`,
        'barrel.ts': `export {render} from './render';`,
        'render.tsx': translated
          ? `import {usePreferences} from './preferences';export function render(item:{caption:string}){const {t}=usePreferences();return t(item.caption)}`
          : `export function render(item:{caption:string}){return item.caption}`,
      }),
    ).toEqual(mode === 'visible' ? ['Please sign in'] : []);
  });

test('named and inline map callbacks report the same visible copy', () => {
  const items = `const items=[{caption:'Please sign in'}];`;
  expect(
    scan({
      'View.tsx': `${items}const render=(item:{caption:string})=><p>{item.caption}</p>;export const View=()=> <>{items.map(render)}</>`,
    }),
  ).toEqual(['Please sign in']);
  expect(
    scan({
      'View.tsx': `${items}export const View=()=> <>{items.map((item)=><p>{item.caption}</p>)}</>`,
    }),
  ).toEqual(['Please sign in']);
});

test('a named callback retains only the visible map collection', () => {
  const callback = `const label=(item:{caption:string})=>item.caption;`;
  expect(
    scan({
      'View.tsx': `${callback}const diagnostic=[{caption:'Diagnostic copy'}].map(label);export const View=()=> <p>{[{caption:42}].map(label)}</p>`,
    }),
  ).toEqual([]);
  expect(
    scan({
      'View.tsx': `${callback}const diagnostic=[{caption:'Diagnostic copy'}].map(label);export const View=()=> <p>{[{caption:'Visible copy'}].map(label)}</p>`,
    }),
  ).toEqual(['Visible copy']);
});

test('a named flatMap callback retains only its visible array result', () => {
  const callback = `const label=(item:{caption:string})=>[item.caption];`;
  expect(
    scan({
      'View.tsx': `${callback}const diagnostic=[{caption:'Diagnostic copy'}].flatMap(label);export const View=()=> <p>{[{caption:42}].flatMap(label).join('')}</p>`,
    }),
  ).toEqual([]);
  expect(
    scan({
      'View.tsx': `${callback}const diagnostic=[{caption:'Diagnostic copy'}].flatMap(label);export const View=()=> <p>{[{caption:'Visible copy'}].flatMap(label).join('')}</p>`,
    }),
  ).toEqual(['Visible copy']);
  expect(
    scan({
      'View.tsx': `const items=[{caption:'Visible copy'}];export const View=()=> <p>{items.flatMap((item)=>[item.caption]).join('')}</p>`,
    }),
  ).toEqual(['Visible copy']);
});

test('a named callback traces JSX fragments and display sinks in its map context', () => {
  expect(
    scan({
      'View.tsx': `const items=[{caption:'Caption copy',title:'Title copy',children:'Children copy',html:'HTML copy'}];
      const render=(item:typeof items[number])=> <><p title={item.title}>{item.caption}</p><p {...{children:item.children}}/><div dangerouslySetInnerHTML={{__html:item.html}}/></>;
      export const View=()=> <>{items.map(render)}</>`,
    }),
  ).toEqual(['Caption copy', 'Title copy', 'Children copy', 'HTML copy']);
});

test('a named callback retains custom component props in its map context', () => {
  const row = `function Row({entry}:{entry:{caption:string}}){return <p>{entry.caption}</p>}`;
  expect(
    scan({
      'View.tsx': `const items=[{caption:'Visible copy'}];${row}const render=(item:typeof items[number])=> <Row entry={item}/>;export const View=()=> <>{items.map(render)}</>`,
    }),
  ).toEqual(['Visible copy']);
  expect(
    scan({
      'View.tsx': `import {Row} from './barrel';const items=[{caption:'Visible copy'}];const render=(item:typeof items[number])=> <Row entry={item}/>;export const View=()=> <>{items.map(render)}</>`,
      'barrel.ts': `export {Row} from './Row';`,
      'Row.tsx': `export ${row}`,
    }),
  ).toEqual(['Visible copy']);
  expect(
    scan({
      'View.tsx': `${row}const render=(item:{caption:string})=> <Row entry={item}/>;const diagnostic=[{caption:'Diagnostic copy'}].map(render);export const View=()=> <>{[{caption:42}].map(render)}</>`,
    }),
  ).toEqual([]);
});
