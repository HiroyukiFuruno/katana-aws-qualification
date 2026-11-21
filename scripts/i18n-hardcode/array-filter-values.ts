import { selectionRange } from './array-selector.ts';
import { type Ast, arrayExpression, arraySpread, type Origin, type Path } from './ast.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];
type InputRange = { start: number; end: number };
type Element = { spread: boolean; value: Ast | undefined };

export function arrayFilter(path: Path) {
  const head = path[0];
  return typeof head === 'object' && head.kind === 'array-filter' ? head : undefined;
}

export function arrayElementTruth(value: Ast | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value.type === 'NullLiteral') return false;
  if (value.type === 'BooleanLiteral') return Boolean(value.value);
  if (value.type === 'NumericLiteral') return Number(value.value) !== 0;
  if (value.type === 'StringLiteral') return String(value.value).length > 0;
  if (
    ['ArrayExpression', 'ObjectExpression', 'ArrowFunctionExpression', 'FunctionExpression'].includes(
      value.type,
    )
  )
    return true;
  return undefined;
}

function filteredPath(path: Path) {
  let { end, rest, start } = selectionRange(path);
  if (rest[0] === '*') rest = rest.slice(1);
  return { end, rest, start };
}

function literalElements(node: Ast | undefined): Element[] | undefined {
  if (node?.type !== 'ArrayExpression' || !Array.isArray(node.elements)) return undefined;
  const elements: Element[] = [];
  for (const entry of node.elements) {
    const value = arrayExpression(entry);
    if (!arraySpread(entry)) elements.push({ spread: false, value });
    else {
      const nested = literalElements(value);
      if (!nested) return undefined;
      elements.push(...nested);
    }
  }
  return elements;
}

export function filteredValues(node: Ast, path: Path, recur: Recur, input?: InputRange): Origin[] {
  const selector = arrayFilter(path);
  if (!selector || !Array.isArray(node.elements)) return [];
  const rest = path.slice(1);
  const selectedPath = filteredPath(rest);
  const elementPath = selectedPath.rest;
  const literal = literalElements(node);
  const elements =
    literal ??
    node.elements.map((entry) => ({ spread: arraySpread(entry), value: arrayExpression(entry) }));
  const unknownInput = Boolean(input && !literal && elements.some((entry) => entry.spread));
  let sourceIndex = 0;
  if (selector.predicate === 'unknown' || elements.some((entry) => entry.spread))
    return elements.flatMap((entry) => {
      const selectedInput =
        !input || unknownInput || (sourceIndex >= input.start && sourceIndex < input.end);
      sourceIndex++;
      if (!selectedInput) return [];
      const value = entry.value;
      if (!value || (selector.predicate === 'boolean' && arrayElementTruth(value) === false)) return [];
      return recur(value, entry.spread ? ['*', ...elementPath] : elementPath);
    });
  let certain = 0;
  let possible = 0;
  return elements.flatMap((entry) => {
    const selectedInput =
      !input || unknownInput || (sourceIndex >= input.start && sourceIndex < input.end);
    sourceIndex++;
    if (!selectedInput) return [];
    const value = entry.value;
    const valueTruth = arrayElementTruth(value);
    const minimum = certain;
    const maximum = possible;
    const selected =
      value &&
      valueTruth !== false &&
      (selector.index === undefined || (minimum <= selector.index && selector.index <= maximum)) &&
      minimum < selectedPath.end &&
      maximum >= selectedPath.start;
    if (valueTruth === true) certain++;
    if (valueTruth !== false) possible++;
    return selected ? recur(value, elementPath) : [];
  });
}
