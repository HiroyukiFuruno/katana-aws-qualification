import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { parseSync } from '@swc/core';
import { type Ast, args, ast, bind, key, name, nodes, property, type Source, walk } from './ast.ts';
import { indexModule } from './modules.ts';

export async function readSources(root: string): Promise<Source[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  return Promise.all(paths.map(async (path) => createSource(path, await readFile(path, 'utf8'))));
}

export function createSource(path: string, text: string): Source {
  const tree = parseSync(text, { syntax: 'typescript', tsx: path.endsWith('.tsx') });
  const source: Source = {
    path: resolve(path),
    text,
    ast: tree as unknown as Ast,
    bindings: new Map(),
    imports: new Map(),
    exports: new Map(),
    parents: new WeakMap(),
    errors: new Set(),
  };
  walk(source.ast, (node, parent) => {
    if (parent) source.parents.set(node, parent);
    indexModule(source, node);
    if (node.type === 'AssignmentPattern') {
      const fallback = ast(node.right);
      if (fallback) bind(source, ast(node.left), fallback);
    }
    if (node.type === 'CatchClause') {
      const parameter = ast(node.param);
      if (parameter) source.errors.add(key(parameter));
    }
    if (node.type === 'VariableDeclarator') {
      const init = ast(node.init);
      if (init) bind(source, ast(node.id), init);
    }
    if (node.type === 'AssignmentExpression') {
      const right = ast(node.right);
      if (right && node.operator === '=') bind(source, ast(node.left), right);
      const left = ast(node.left);
      const object = left?.type === 'MemberExpression' ? ast(left.object) : undefined;
      const field = left?.type === 'MemberExpression' ? property(ast(left.property)) : '';
      if (right && object?.type === 'Identifier' && field && field !== '*' && node.operator === '=') {
        bind(source, object, {
          type: 'ObjectExpression',
          span: node.span,
          properties: [
            {
              type: 'KeyValueProperty',
              key: { type: 'Identifier', value: field },
              value: right,
            },
          ],
        });
      }
    }
    if (node.type === 'FunctionDeclaration') {
      const id = ast(node.identifier);
      if (id) bind(source, id, node);
    }
    if (node.type === 'CallExpression') indexCollection(source, node);
  });
  indexState(source);
  return source;
}

function indexCollection(source: Source, node: Ast) {
  const callee = ast(node.callee);
  if (callee?.type !== 'MemberExpression') return;
  const method = property(ast(callee.property));
  if (!['map', 'flatMap', 'filter', 'find'].includes(method)) return;
  const callback = args(node)[0];
  const collection = ast(callee.object);
  if (callback && collection) bind(source, nodes(callback.params)[0], collection, ['*']);
}

function indexState(source: Source) {
  const setters = new Map<string, Ast>();
  walk(source.ast, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const id = ast(node.id);
    const init = ast(node.init);
    if (id?.type !== 'ArrayPattern' || init?.type !== 'CallExpression') return;
    const callee = ast(init.callee);
    if (
      (callee?.type === 'MemberExpression' ? property(ast(callee.property)) : name(callee)) !==
      'useState'
    )
      return;
    const [value, setter] = nodes(id.elements);
    const initial = args(init)[0];
    if (value && initial) bind(source, value, initial);
    if (value && setter) setters.set(key(setter), value);
  });
  walk(source.ast, (node) => {
    const callee = ast(node.callee);
    if (node.type !== 'CallExpression' || !callee) return;
    const value = setters.get(key(callee));
    const next = args(node)[0];
    if (value && next) bind(source, value, next);
  });
}

export function importedSource(sources: Source[], source: Source, specifier: string) {
  if (!specifier.startsWith('.')) return undefined;
  const target = resolve(dirname(source.path), specifier);
  return sources.find(
    (candidate) =>
      candidate.path === target ||
      (!extname(target) &&
        ['.ts', '.tsx', '/index.ts', '/index.tsx'].some((suffix) => candidate.path === target + suffix)),
  );
}
