import { arrayElementTruth } from './array-filter-values.ts';
import {
  type Ast,
  args,
  arrayExpression,
  arraySpread,
  ast,
  type Binding,
  key,
  name,
  type Path,
  property,
  type Source,
} from './ast.ts';
import { environmentKey } from './calls.ts';
import { singleUseAlias } from './concat-index.ts';

type Entry = Ast | undefined;

function integer(node: Ast | undefined) {
  return node?.type === 'NumericLiteral' && Number.isInteger(node.value)
    ? Number(node.value)
    : undefined;
}

function mappedValue(callback: Ast | undefined, value: Entry): Ast | undefined {
  if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type))
    return undefined;
  const body = ast(callback.body);
  const parameter = Array.isArray(callback.params) ? ast(callback.params[0]) : undefined;
  if (body?.type === 'Identifier' && parameter?.type === 'Identifier' && key(body) === key(parameter))
    return value;
  return body && ['NullLiteral', 'BooleanLiteral', 'NumericLiteral', 'StringLiteral'].includes(body.type)
    ? body
    : undefined;
}

function values(
  source: Source,
  node: Ast | undefined,
  environment: Map<string, Binding[]>,
  seen: Set<string>,
): Entry[] | undefined {
  if (!node) return undefined;
  if (node.type === 'ArrayExpression')
    return Array.isArray(node.elements) && !node.elements.some(arraySpread)
      ? node.elements.map(arrayExpression)
      : undefined;
  if (node.type === 'Identifier') {
    if (!singleUseAlias(source, node)) return undefined;
    const bindings =
      environment.get(environmentKey(source, key(node))) ?? source.bindings.get(key(node));
    const binding = bindings?.length === 1 ? bindings[0] : undefined;
    const marker = `${source.path}:${key(node)}`;
    return binding && !binding.path.length && !seen.has(marker)
      ? values(binding.source ?? source, binding.expression, environment, new Set(seen).add(marker))
      : undefined;
  }
  if (node.type !== 'CallExpression') return undefined;
  const callee = ast(node.callee);
  if (callee?.type !== 'MemberExpression') return undefined;
  const receiver = values(source, ast(callee.object), environment, seen);
  if (!receiver) return undefined;
  const method = property(ast(callee.property));
  if (method === 'slice') {
    const [startNode, endNode] = args(node);
    const start = startNode ? integer(startNode) : 0;
    const end = endNode ? integer(endNode) : undefined;
    return start === undefined || start < 0 || (endNode && (end === undefined || end < 0))
      ? undefined
      : receiver.slice(start, end);
  }
  if (method === 'filter' && name(args(node)[0]) === 'Boolean') {
    const decisions = receiver.map(arrayElementTruth);
    return decisions.some((decision) => decision === undefined)
      ? undefined
      : receiver.filter((_, index) => decisions[index]);
  }
  if (method === 'map') {
    const output = receiver.map((value) =>
      value === undefined ? value : mappedValue(args(node)[0], value),
    );
    return output.some((value, index) => receiver[index] !== undefined && value === undefined)
      ? undefined
      : output;
  }
  return undefined;
}

function selected(values: Entry[], path: Path): Entry[] | undefined {
  let output = values;
  let rest = path;
  const filter = rest[0];
  if (typeof filter === 'object' && filter.kind === 'array-filter') {
    if (filter.predicate !== 'boolean') return undefined;
    const decisions = output.map(arrayElementTruth);
    if (decisions.some((decision) => decision === undefined)) return undefined;
    output = output.filter((_, index) => decisions[index]);
    if (filter.index !== undefined) output = output.slice(filter.index, filter.index + 1);
    rest = rest.slice(1);
  }
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  while (typeof rest[0] === 'object') {
    const head = rest[0];
    if (head.kind === 'array-rest') start += head.start;
    else if (head.kind === 'array-range') {
      end = Math.min(end, start + head.end);
      start += head.start;
    } else return undefined;
    rest = rest.slice(1);
  }
  if (typeof rest[0] === 'string' && /^(0|[1-9][0-9]*)$/.test(rest[0])) {
    start += Number(rest[0]);
    end = Math.min(end, start + 1);
    rest = rest.slice(1);
  } else if (rest[0] === '*') rest = rest.slice(1);
  else if (rest[0] !== undefined) return undefined;
  if (rest.length) return undefined;
  return output.slice(start, end).flatMap((value) => (value ? [value] : []));
}

export function knownSelectedArrayValues(
  source: Source,
  node: Ast,
  path: Path,
  environment: Map<string, Binding[]>,
) {
  const known = values(source, node, environment, new Set());
  const output = known === undefined ? undefined : selected(known, path);
  return output?.every((value) => value && /Literal$/.test(value.type)) ? output : undefined;
}
