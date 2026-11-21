import { type Ast, args, ast, name, type Path } from './ast.ts';

function integer(node: Ast | undefined) {
  if (node?.type === 'NumericLiteral' && typeof node.value === 'number' && Number.isInteger(node.value))
    return node.value;
  const argument = ast(node?.argument);
  return node?.type === 'UnaryExpression' && node.operator === '-' && argument?.type === 'NumericLiteral'
    ? -Number(argument.value)
    : undefined;
}

function index(path: Path) {
  return typeof path[0] === 'string' && /^(0|[1-9][0-9]*)$/.test(path[0]) ? Number(path[0]) : undefined;
}

function all(path: Path): Path[] {
  const current = selectionRange(path);
  const head = current.rest[0];
  const rest = head === '*' || index(current.rest) !== undefined ? current.rest.slice(1) : current.rest;
  if (current.end !== Number.POSITIVE_INFINITY)
    return [[{ kind: 'array-range', start: current.start, end: current.end }, '*', ...rest]];
  if (current.start) return [[{ kind: 'array-rest', start: current.start }, '*', ...rest]];
  return [['*', ...rest]];
}

export function selectionRange(path: Path) {
  let rest = path;
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  while (typeof rest[0] === 'object') {
    const head = rest[0];
    if (head.kind === 'array-rest') start += head.start;
    else if (head.kind === 'array-range') {
      end = Math.min(end, start + head.end);
      start += head.start;
    } else break;
    rest = rest.slice(1);
  }
  return { end, rest, start };
}

export function slicePaths(node: Ast, path: Path): Path[] {
  const [startNode, endNode] = args(node);
  const start = startNode ? integer(startNode) : 0;
  const end = endNode ? integer(endNode) : undefined;
  if (start === undefined || start < 0 || (endNode && (end === undefined || end < 0))) return all(path);
  const current = selectionRange(path);
  const selected = index(current.rest);
  const first = start + current.start;
  const limit = Math.min(end ?? Number.POSITIVE_INFINITY, start + current.end);
  if (first >= limit) return [];
  if (selected !== undefined) {
    const original = first + selected;
    return original >= limit ? [] : [[String(original), ...current.rest.slice(1)]];
  }
  if (!path.length) {
    return limit === Number.POSITIVE_INFINITY
      ? first
        ? [[{ kind: 'array-rest', start: first }]]
        : [path]
      : [[{ kind: 'array-range', start: first, end: limit }]];
  }
  const head = current.rest[0];
  if (!head)
    return limit === Number.POSITIVE_INFINITY
      ? [[{ kind: 'array-rest', start: first }, '*']]
      : [[{ kind: 'array-range', start: first, end: limit }, '*']];
  if (head === '*' || (typeof head === 'object' && head.kind === 'array-filter'))
    return limit === Number.POSITIVE_INFINITY
      ? [
          [
            { kind: 'array-rest', start: first },
            ...(head === '*' ? current.rest : ['*', ...current.rest]),
          ],
        ]
      : [
          [
            { kind: 'array-range', start: first, end: limit },
            ...(head === '*' ? current.rest : ['*', ...current.rest]),
          ],
        ];
  if (typeof head === 'object' && head.kind === 'array-rest')
    return [[{ kind: 'array-rest', start: first + head.start }, ...current.rest.slice(1)]];
  return path.length ? all(path) : [path];
}

function constantPredicate(node: Ast | undefined) {
  const body = ast(node?.body);
  return body?.type === 'BooleanLiteral' && typeof body.value === 'boolean' ? body.value : undefined;
}

export function filterPaths(node: Ast, path: Path): Path[] {
  const predicate = args(node)[0];
  const constant = constantPredicate(predicate);
  if (constant === true) return [path];
  if (constant === false) return [];
  const selected = index(path);
  const kind = name(predicate) === 'Boolean' ? 'boolean' : 'unknown';
  const existing = path.findIndex((part) => typeof part === 'object' && part.kind === 'array-filter');
  if (existing >= 0)
    return [
      path.map((part, position) =>
        position === existing &&
        typeof part === 'object' &&
        part.kind === 'array-filter' &&
        part.predicate === 'unknown' &&
        kind === 'boolean'
          ? { ...part, predicate: 'boolean' }
          : part,
      ),
    ];
  if (selected !== undefined)
    return [[{ kind: 'array-filter', predicate: kind, index: selected }, ...path.slice(1)]];
  return [[{ kind: 'array-filter', predicate: kind }, ...path]];
}
