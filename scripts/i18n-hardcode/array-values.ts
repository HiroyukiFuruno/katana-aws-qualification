import { type Ast, ast, type Origin, type Path } from './ast.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];

function expression(entry: unknown) {
  return typeof entry === 'object' && entry !== null && 'expression' in entry
    ? ast(entry.expression)
    : undefined;
}

function spread(entry: unknown) {
  return typeof entry === 'object' && entry !== null && 'spread' in entry && entry.spread !== null;
}

function knownLength(node: Ast | undefined): number | undefined {
  if (node?.type !== 'ArrayExpression' || !Array.isArray(node.elements)) return undefined;
  let length = 0;
  for (const entry of node.elements) {
    if (!spread(entry)) {
      length++;
      continue;
    }
    const nested = knownLength(expression(entry));
    if (nested === undefined) return undefined;
    length += nested;
  }
  return length;
}

function pathSelector(path: Path) {
  let [head, ...rest] = path;
  let start = 0;
  while (head && typeof head !== 'string') {
    if (head.kind !== 'array-rest') return undefined;
    start += head.start;
    [head, ...rest] = rest;
  }
  const index =
    typeof head === 'string' && /^(0|[1-9][0-9]*)$/.test(head) ? Number(head) + start : undefined;
  return head !== undefined && head !== '*' && index === undefined ? undefined : { index, rest, start };
}

function spreadPaths(
  index: number | undefined,
  rest: Path,
  start: number,
  offset: number,
  unknown: boolean,
  length: number | undefined,
): Path[] {
  if (index === undefined)
    return [[{ kind: 'array-rest', start: unknown ? 0 : Math.max(0, start - offset) }, ...rest]];
  if (!unknown) return [[String(index - offset), ...rest]];
  if (length === undefined) return [['*', ...rest]];
  return Array.from({ length: Math.min(length, index - offset + 1) }, (_, relative) => [
    String(relative),
    ...rest,
  ]);
}

export function arrayValues(node: Ast, path: Path, recur: Recur): Origin[] {
  if (!Array.isArray(node.elements)) return [];
  const selector = pathSelector(path);
  if (!selector) return [];
  const { index, rest, start } = selector;
  let offset = 0;
  let unknownPrefix = false;
  return node.elements.flatMap((entry) => {
    const value = expression(entry);
    if (!value) {
      offset++;
      return [];
    }
    if (!spread(entry)) {
      const selected =
        index === undefined
          ? unknownPrefix || offset >= start
          : unknownPrefix
            ? index >= offset
            : index === offset;
      offset++;
      return selected ? recur(value, rest) : [];
    }
    const length = knownLength(value);
    const selected =
      index === undefined ||
      (unknownPrefix
        ? index >= offset
        : length === undefined
          ? index >= offset
          : index >= offset && index < offset + length);
    const childPaths = spreadPaths(index, rest, start, offset, unknownPrefix, length);
    if (length === undefined) unknownPrefix = true;
    else offset += length;
    return selected ? childPaths.flatMap((childPath) => recur(value, childPath)) : [];
  });
}
