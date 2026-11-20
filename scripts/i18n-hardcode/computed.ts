import { type Ast, ast, key, name, type Source } from './ast.ts';

export function narrowedKeys(
  source: Source,
  node: Ast,
  index: Ast | undefined,
  values: string[],
): string[] {
  if (index?.type !== 'Identifier') return values;
  let child = node;
  let parent = source.parents.get(child);
  let result = values;
  while (parent) {
    if (parent.type === 'ConditionalExpression') {
      const matched = comparison(ast(parent.test), index);
      if (matched) {
        const equality = parent.consequent === child ? matched.equal : !matched.equal;
        result = result.filter((value) =>
          equality ? value === matched.value : value !== matched.value,
        );
      }
    }
    child = parent;
    parent = source.parents.get(child);
  }
  return result;
}

function comparison(test: Ast | undefined, index: Ast): { equal: boolean; value: string } | undefined {
  if (test?.type !== 'BinaryExpression') return undefined;
  const operator = String(test.operator);
  if (!['===', '!==', '==', '!='].includes(operator)) return undefined;
  const left = ast(test.left);
  const right = ast(test.right);
  if (left?.type === 'Identifier' && key(left) === key(index) && right?.type === 'StringLiteral') {
    return { equal: operator === '===' || operator === '==', value: name(right) };
  }
  if (right?.type === 'Identifier' && key(right) === key(index) && left?.type === 'StringLiteral') {
    return { equal: operator === '===' || operator === '==', value: name(left) };
  }
  return undefined;
}

export function technicalIdentifier(field: string, node: Ast | undefined): boolean {
  if (!['id', 'code', 'slug'].includes(field) || node?.type !== 'StringLiteral') return false;
  return /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)+$/.test(name(node));
}
