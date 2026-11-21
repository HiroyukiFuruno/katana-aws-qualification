import { type Ast, ast, type Binding, key, name, type Path, type Source, walk } from './ast.ts';
import { environmentKey } from './calls.ts';

const wrappers = new Set([
  'ParenthesisExpression',
  'TsAsExpression',
  'TsSatisfiesExpression',
  'TsNonNullExpression',
  'TsTypeAssertion',
  'TsConstAssertion',
]);

function fixedIndex(path: Path) {
  const value = path[0];
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : undefined;
}

function unwrap(node: Ast | undefined): Ast | undefined {
  while (node && wrappers.has(node.type)) node = ast(node.expression);
  return node;
}

function isSpread(element: unknown) {
  return (
    typeof element === 'object' &&
    element !== null &&
    'spread' in element &&
    (element as { spread?: unknown }).spread !== null
  );
}

export function singleUseAlias(source: Source, identifier: Ast) {
  const identifierKey = key(identifier);
  let references = 0;
  walk(source.ast, (node) => {
    if (node.type === 'Identifier' && key(node) === identifierKey) references += 1;
  });
  return (
    references === 2 &&
    ![...source.exports.entries()].some(
      ([exported, value]) => exported === name(identifier) || name(value) === name(identifier),
    )
  );
}

function occupied(
  source: Source,
  node: Ast | undefined,
  index: number,
  environment: Map<string, Binding[]>,
  seen: Set<string>,
): boolean {
  node = unwrap(node);
  if (!node) return false;
  if (node.type === 'ArrayExpression') {
    const elements = Array.isArray(node.elements) ? node.elements : [];
    return !elements.some(isSpread) && index < elements.length;
  }
  if (node.type !== 'Identifier') return false;
  if (!singleUseAlias(source, node)) return false;
  const identifier = key(node);
  const marker = `${source.path}:${identifier}`;
  if (seen.has(marker)) return false;
  const bindings =
    environment.get(environmentKey(source, identifier)) ?? source.bindings.get(identifier) ?? [];
  if (!bindings.length || bindings.some((binding) => binding.path.length > 0)) return false;
  const nextSeen = new Set(seen).add(marker);
  return bindings.every((binding) =>
    occupied(binding.source ?? source, binding.expression, index, environment, nextSeen),
  );
}

export function knownArrayIndexOccupied(
  source: Source,
  receiver: Ast | undefined,
  path: Path,
  environment: Map<string, Binding[]>,
): boolean {
  const index = fixedIndex(path);
  return index !== undefined && occupied(source, receiver, index, environment, new Set());
}
