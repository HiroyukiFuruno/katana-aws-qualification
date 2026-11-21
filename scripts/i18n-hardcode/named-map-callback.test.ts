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
