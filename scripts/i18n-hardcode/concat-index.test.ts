import { expect, test } from 'bun:test';
import { type Ast, type Binding, type Path, walk } from './ast.ts';
import { knownArrayIndexOccupied } from './concat-index.ts';
import { createSource } from './sources.ts';

function check(expression: string, name = 'parts', path: Path = ['0']) {
  const source = createSource('/fixture/View.tsx', `const ${name}=${expression};`);
  const receiver = [...source.bindings.entries()].find(([bindingKey]) =>
    bindingKey.startsWith(`${name}:`),
  )?.[1][0]?.expression;
  return knownArrayIndexOccupied(source, receiver, path, new Map<string, Binding[]>());
}

function checkCode(code: string, name = 'parts') {
  const source = createSource('/fixture/View.tsx', code);
  let receiver: Ast | undefined;
  walk(source.ast, (node) => {
    if (!receiver && node.type === 'Identifier' && node.value === name) receiver = node;
  });
  return knownArrayIndexOccupied(source, receiver, ['0'], new Map<string, Binding[]>());
}

test('recognizes literal, nested aliases, and wrapper expressions', () => {
  expect(check('[42]')).toBe(true);
  expect(check('((([42] as const)))')).toBe(true);
  const source = createSource('/fixture/View.tsx', 'const first=[42]; const parts=first;');
  const receiver = [...source.bindings.entries()].find(([bindingKey]) =>
    bindingKey.startsWith('parts:'),
  )?.[1][0]?.expression;
  expect(knownArrayIndexOccupied(source, receiver, ['0'], new Map())).toBe(true);
});

test('keeps empty and out-of-range indexes available to concat', () => {
  expect(check('[]')).toBe(false);
  expect(check('[42]', 'parts', ['1'])).toBe(false);
  expect(check('[,42]')).toBe(true);
});

test('rejects spreads, non-arrays, dynamic paths, and cycles', () => {
  expect(check('[...values]')).toBe(false);
  expect(check('{value:42}')).toBe(false);
  expect(check('[42]', 'parts', ['*'])).toBe(false);
  const source = createSource('/fixture/View.tsx', 'let parts:any; parts=parts;');
  const receiver = [...source.bindings.entries()].find(([bindingKey]) =>
    bindingKey.startsWith('parts:'),
  )?.[1][0]?.expression;
  expect(knownArrayIndexOccupied(source, receiver, ['0'], new Map())).toBe(false);
});

test('requires every alias candidate to occupy the fixed index', () => {
  const source = createSource('/fixture/View.tsx', 'let parts; parts=[42]; parts=[];');
  const receiver = source.bindings.get('parts:0')?.[0]?.expression;
  expect(knownArrayIndexOccupied(source, receiver, ['0'], new Map())).toBe(false);
});

test('only allows immutable-looking single-use aliases', () => {
  expect(checkCode("const parts=[42];parts.concat('Visible copy');")).toBe(true);
  expect(checkCode("const a=[42];const parts=a;parts.concat('Visible copy');")).toBe(true);
  expect(checkCode("const parts=[42];parts.pop();parts.concat('Visible copy');")).toBe(false);
  expect(checkCode("const parts=[42];consume(parts);parts.concat('Visible copy');")).toBe(false);
  expect(checkCode("export const parts=[42];parts.concat('Visible copy');")).toBe(false);
});
