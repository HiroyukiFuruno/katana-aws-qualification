import { type Ast, arrayExpression, arraySpread, type Origin, type Path } from './ast.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];

export function arrayFilter(path: Path) {
  const head = path[0];
  return typeof head === 'object' && head.kind === 'array-filter' ? head : undefined;
}

function truth(value: Ast | undefined): boolean | undefined {
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

export function filteredValues(node: Ast, path: Path, recur: Recur): Origin[] {
  const selector = arrayFilter(path);
  if (!selector || !Array.isArray(node.elements)) return [];
  const rest = path.slice(1);
  if (selector.predicate === 'unknown' || node.elements.some(arraySpread))
    return node.elements.flatMap((entry) => {
      const value = arrayExpression(entry);
      if (!value || (selector.predicate === 'boolean' && truth(value) === false)) return [];
      return recur(value, arraySpread(entry) ? ['*', ...rest] : rest);
    });
  let certain = 0;
  let possible = 0;
  return node.elements.flatMap((entry) => {
    const value = arrayExpression(entry);
    const valueTruth = truth(value);
    const selected =
      value &&
      valueTruth !== false &&
      (selector.index === undefined || (certain <= selector.index && selector.index <= possible));
    if (valueTruth === true) certain++;
    if (valueTruth !== false) possible++;
    return selected ? recur(value, rest) : [];
  });
}
