import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string, extras: Record<string, string> = {}) {
  return checkSources(
    [
      createSource('/fixture/View.tsx', code),
      ...Object.entries(extras).map(([path, text]) => createSource(`/fixture/${path}`, text)),
    ],
    '/fixture',
  ).map((finding) => finding.text);
}

test('standard dialog members on window and globalThis expose their visible messages', () => {
  for (const receiver of ['window', 'globalThis']) {
    expect(
      scan(`${receiver}.alert('Alert text'); ${receiver}.confirm('Confirm text');
      ${receiver}['prompt']('Prompt text')`),
    ).toEqual(['Alert text', 'Confirm text', 'Prompt text']);
  }
});

test('arbitrary objects and shadowed global names are not native dialog sinks', () => {
  expect(
    scan(`const service={confirm(value:string){return value}};service.confirm('Protocol operation');
    function local(window:{alert:(value:string)=>void}){window.alert('Internal operation')}
    const globalThis={prompt(value:string){return value}};globalThis.prompt('Internal prompt');`),
  ).toEqual([]);
});

test('star reexports preserve literal origins', () => {
  expect(
    scan(`import {copy} from './barrel'; export const View=()=> <p>{copy}</p>`, {
      'barrel.ts': `export * from './copy'`,
      'copy.ts': `export const copy='Please sign in'`,
    }),
  ).toEqual(['Please sign in']);
});

test('nested and cyclic star barrels terminate while still finding reachable copy', () => {
  expect(
    scan(`import {copy} from './first'; export const View=()=> <p>{copy}</p>`, {
      'first.ts': `export * from './second'`,
      'second.ts': `export * from './first'; export * from './copy'`,
      'copy.ts': `export const copy='Nested copy'`,
    }),
  ).toEqual(['Nested copy']);
  expect(
    scan(`import {missing} from './first'; export const View=()=> <p>{missing}</p>`, {
      'first.ts': `export * from './second'`,
      'second.ts': `export * from './first'`,
    }),
  ).toEqual([]);
});

test('explicit named exports shadow star exports regardless of declaration order', () => {
  expect(
    scan(`import {copy} from './barrel'; export const View=()=> <p>{copy}</p>`, {
      'barrel.ts': `export * from './old'; export {copy} from './current'`,
      'old.ts': `export const copy='Shadowed copy'`,
      'current.ts': `export const copy='Current copy'`,
    }),
  ).toEqual(['Current copy']);
});

test('star exports never forward default exports', () => {
  expect(
    scan(
      `import value from './barrel';import * as ns from './barrel';
    export const View=()=> <p>{value}{ns.default}</p>`,
      {
        'barrel.ts': `export * from './copy'`,
        'copy.ts': `export default 'Hidden default'`,
      },
    ),
  ).toEqual([]);
});

test('star-exported helper arguments and custom component props remain traceable', () => {
  expect(
    scan(
      `import {format,Box} from './barrel';
    export const View=()=> <><p>{format('Helper copy')}</p><Box content="Component copy"/></>`,
      {
        'barrel.ts': `export * from './copy'`,
        'copy.tsx': `export function format(value:string){return value}
      export function Box({content}:{content:string}){return <p>{content}</p>}`,
      },
    ),
  ).toEqual(['Helper copy', 'Component copy']);
});

test('two star paths to one binding resolve once while ambiguous distinct bindings do not resolve', () => {
  expect(
    scan(`import {copy} from './barrel';export const View=()=> <p>{copy}</p>`, {
      'barrel.ts': `export * from './left';export * from './right'`,
      'left.ts': `export {copy} from './copy'`,
      'right.ts': `export * from './copy'`,
      'copy.ts': `export const copy='Shared binding'`,
    }),
  ).toEqual(['Shared binding']);
  expect(
    scan(`import {copy} from './barrel';export const View=()=> <p>{copy}</p>`, {
      'barrel.ts': `export * from './left';export * from './right'`,
      'left.ts': `export const copy='Left copy'`,
      'right.ts': `export const copy='Right copy'`,
    }),
  ).toEqual([]);
});
