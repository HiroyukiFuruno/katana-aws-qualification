import {
  type Ast,
  ast,
  type Binding,
  key,
  name,
  type Origin,
  type Path,
  type Source,
  walk,
} from './ast.ts';
import { environmentKey } from './calls.ts';
import { scalarConcatArgument } from './concat-shape.ts';

const wrappers = new Set([
  'ParenthesisExpression',
  'TsAsExpression',
  'TsSatisfiesExpression',
  'TsNonNullExpression',
  'TsTypeAssertion',
  'TsConstAssertion',
]);

export function fixedIndex(path: Path) {
  const value = path[0];
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : undefined;
}

export function unwrap(node: Ast | undefined): Ast | undefined {
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

export function knownArrayLength(
  source: Source,
  node: Ast | undefined,
  environment: Map<string, Binding[]>,
  seen: Set<string>,
): number | undefined {
  node = unwrap(node);
  if (!node) return undefined;
  if (node.type === 'ArrayExpression') {
    const elements = Array.isArray(node.elements) ? node.elements : [];
    return elements.some(isSpread) ? undefined : elements.length;
  }
  if (node.type !== 'Identifier' || !singleUseAlias(source, node)) return undefined;
  const identifier = key(node);
  const marker = `${source.path}:${identifier}`;
  if (seen.has(marker)) return undefined;
  const bindings =
    environment.get(environmentKey(source, identifier)) ?? source.bindings.get(identifier) ?? [];
  if (!bindings.length || bindings.some((binding) => binding.path.length > 0)) return undefined;
  const nextSeen = new Set(seen).add(marker);
  const lengths = bindings.map((binding) =>
    knownArrayLength(binding.source ?? source, binding.expression, environment, nextSeen),
  );
  return lengths.every((length) => length !== undefined && length === lengths[0])
    ? lengths[0]
    : undefined;
}

export function knownArrayIndexOccupied(
  source: Source,
  receiver: Ast | undefined,
  path: Path,
  environment: Map<string, Binding[]>,
): boolean {
  const index = fixedIndex(path);
  const length = knownArrayLength(source, receiver, environment, new Set());
  return index !== undefined && length !== undefined && index < length;
}

type ConcatArgument = { node: Ast; path: Path };
export type ConcatSelection = { receiver: boolean; arguments: ConcatArgument[] };

export function argumentLength(
  source: Source,
  node: Ast,
  environment: Map<string, Binding[]>,
): { length: number; array: boolean } | undefined {
  node = unwrap(node) ?? node;
  if (node.type === 'SpreadElement') return undefined;
  const length = knownArrayLength(source, node, environment, new Set());
  if (length !== undefined) return { length, array: true };
  return scalarConcatArgument(node) ? { length: 1, array: false } : undefined;
}

export function knownConcatSelection(
  source: Source,
  receiver: Ast | undefined,
  argumentsList: Ast[],
  path: Path,
  environment: Map<string, Binding[]>,
): ConcatSelection | undefined {
  const index = fixedIndex(path);
  const receiverLength = knownArrayLength(source, receiver, environment, new Set());
  if (index === undefined || receiverLength === undefined) return undefined;
  if (index < receiverLength) return { receiver: true, arguments: [] };
  let relative = index - receiverLength;
  for (const argument of argumentsList) {
    const shape = argumentLength(source, argument, environment);
    if (!shape) return undefined;
    if (relative < shape.length)
      return {
        receiver: false,
        arguments: [
          { node: argument, path: shape.array ? [String(relative), ...path.slice(1)] : path.slice(1) },
        ],
      };
    relative -= shape.length;
  }
  return { receiver: false, arguments: [] };
}

export function selectedConcatOrigins(
  selection: ConcatSelection | undefined,
  receiver: Ast | undefined,
  path: Path,
  recur: (node: Ast | undefined, path: Path) => Origin[],
): Origin[] | undefined {
  if (!selection) return undefined;
  return [
    ...(selection.receiver ? recur(receiver, path) : []),
    ...selection.arguments.flatMap((argument) => recur(argument.node, argument.path)),
  ];
}
