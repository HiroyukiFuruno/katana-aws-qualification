import { arrayFilter, filteredValues } from './array-filter-values.ts';
import { type Ast, arrayExpression, arraySpread, type Origin, type Path } from './ast.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];

function knownLength(node: Ast | undefined): number | undefined {
  if (node?.type !== 'ArrayExpression' || !Array.isArray(node.elements)) return undefined;
  let length = 0;
  for (const entry of node.elements) {
    if (!arraySpread(entry)) {
      length++;
      continue;
    }
    const nested = knownLength(arrayExpression(entry));
    if (nested === undefined) return undefined;
    length += nested;
  }
  return length;
}

function pathSelector(path: Path) {
  let [head, ...rest] = path;
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  while (head && typeof head !== 'string') {
    if (head.kind === 'array-rest') start += head.start;
    else if (head.kind === 'array-range') {
      end = Math.min(end, start + head.end);
      start += head.start;
    } else return undefined;
    [head, ...rest] = rest;
  }
  const index =
    typeof head === 'string' && /^(0|[1-9][0-9]*)$/.test(head) ? Number(head) + start : undefined;
  return head !== undefined && head !== '*' && index === undefined
    ? undefined
    : { end, index, rest, start };
}

function spreadPaths(
  index: number | undefined,
  rest: Path,
  start: number,
  end: number,
  offset: number,
  unknown: boolean,
  length: number | undefined,
): Path[] {
  if (index === undefined)
    if (end !== Number.POSITIVE_INFINITY && !unknown)
      return [
        [
          { kind: 'array-range', start: Math.max(0, start - offset), end: Math.max(0, end - offset) },
          '*',
          ...rest,
        ],
      ];
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
  if (arrayFilter(path)) return filteredValues(node, path, recur);
  const selector = pathSelector(path);
  if (!selector) return [];
  const { end, index, rest, start } = selector;
  let offset = 0;
  let unknownPrefix = false;
  return node.elements.flatMap((entry) => {
    const value = arrayExpression(entry);
    if (!value) {
      offset++;
      return [];
    }
    if (!arraySpread(entry)) {
      const selected =
        index === undefined
          ? unknownPrefix || (offset >= start && offset < end)
          : unknownPrefix
            ? index >= offset
            : index === offset;
      offset++;
      return selected ? recur(value, rest) : [];
    }
    const length = knownLength(value);
    const selected =
      index === undefined
        ? unknownPrefix || (offset < end && (length === undefined || offset + length > start))
        : unknownPrefix
          ? index >= offset
          : length === undefined
            ? index >= offset
            : index >= offset && index < offset + length;
    const childPaths = spreadPaths(index, rest, start, end, offset, unknownPrefix, length);
    if (length === undefined) unknownPrefix = true;
    else offset += length;
    return selected ? childPaths.flatMap((childPath) => recur(value, childPath)) : [];
  });
}
