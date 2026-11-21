import { expect, test } from 'bun:test';
import { checkSources } from './check.ts';
import { createSource } from './sources.ts';

function scan(code: string, extras: Record<string, string>) {
  return checkSources(
    [
      createSource('/fixture/View.tsx', code),
      ...Object.entries(extras).map(([path, text]) => createSource(`/fixture/${path}`, text)),
    ],
    '/fixture',
  ).map((finding) => finding.text);
}

test('reexported namespace imports retain the displayed member path', () => {
  expect(
    scan(`import {copy} from './barrel';export const View=()=> <p>{copy.caption}</p>`, {
      'barrel.ts': `import * as copy from './copy';export {copy}`,
      'copy.ts': `export const caption='Please sign in'`,
    }),
  ).toEqual(['Please sign in']);
});

test('namespace bindings survive aliases through several named barrels', () => {
  expect(
    scan(`import {bundle as copy} from './outer';export const View=()=> <p>{copy.caption}</p>`, {
      'outer.ts': `import {labels as renamed} from './inner';export {renamed as bundle}`,
      'inner.ts': `import * as source from './copy';export {source as labels}`,
      'copy.ts': `export const caption='Aliased namespace copy'`,
    }),
  ).toEqual(['Aliased namespace copy']);
});

test('nested namespace members keep every path segment', () => {
  expect(
    scan(`import {bundle} from './outer';export const View=()=> <p>{bundle.labels.caption}</p>`, {
      'outer.ts': `import * as source from './inner';export {source as bundle}`,
      'inner.ts': `import * as source from './copy';export {source as labels}`,
      'copy.ts': `export const caption='Nested namespace copy'`,
    }),
  ).toEqual(['Nested namespace copy']);
});

test('namespace bindings pass through cyclic star barrels without losing their members', () => {
  expect(
    scan(`import {copy} from './outer';export const View=()=> <p>{copy.caption}</p>`, {
      'outer.ts': `export * from './inner'`,
      'inner.ts': `export * from './outer';import * as copy from './copy';export {copy}`,
      'copy.ts': `export const caption='Cyclic namespace copy'`,
    }),
  ).toEqual(['Cyclic namespace copy']);
});

test('namespace objects expose explicit default members even though star exports do not', () => {
  expect(
    scan(`import {copy} from './barrel';export const View=()=> <p>{copy.default}</p>`, {
      'barrel.ts': `import * as copy from './copy';export {copy}`,
      'copy.ts': `export default 'Namespace default copy'`,
    }),
  ).toEqual(['Namespace default copy']);
});

test('two star paths to the same module namespace preserve one namespace binding', () => {
  expect(
    scan(`import {copy} from './barrel';export const View=()=> <p>{copy.caption}</p>`, {
      'barrel.ts': `export * from './left';export * from './right'`,
      'left.ts': `import * as copy from './copy';export {copy}`,
      'right.ts': `import * as source from './copy';export {source as copy}`,
      'copy.ts': `export const caption='Shared namespace copy'`,
    }),
  ).toEqual(['Shared namespace copy']);
});
