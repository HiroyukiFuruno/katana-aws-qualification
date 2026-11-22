import { parseSync } from '@swc/core';

const displayAttributes = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
  'data-label',
]);
const words = /\p{L}/u;
type Node = Record<string, unknown>;
const node = (value: unknown): value is Node => value !== null && typeof value === 'object';

function displayLiterals(value: unknown): string[] {
  if (!node(value)) return [];
  if (value.type === 'StringLiteral') return [String(value.value)];
  if (value.type === 'ConditionalExpression')
    return [...displayLiterals(value.consequent), ...displayLiterals(value.alternate)];
  if (value.type === 'BinaryExpression' && ['&&', '||', '??', '+'].includes(String(value.operator)))
    return value.operator === '+'
      ? [...displayLiterals(value.left), ...displayLiterals(value.right)]
      : displayLiterals(value.right);
  if (value.type === 'TemplateLiteral' && Array.isArray(value.quasis))
    return value.quasis.filter(node).map((part) => String(part.cooked ?? part.raw ?? ''));
  return [];
}

export function hardcodedUiIssues(source: string, filename: string, includeContentLabels = false) {
  const issues: string[] = [];
  function visit(value: unknown, property = '') {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, property);
      return;
    }
    if (!node(value)) return;
    let texts: string[] = [];
    if (
      includeContentLabels &&
      value.type === 'KeyValueProperty' &&
      node(value.key) &&
      value.key.value === 'label'
    )
      texts = displayLiterals(value.value);
    if (value.type === 'JSXText') texts = [String(value.value)];
    if (
      value.type === 'JSXAttribute' &&
      node(value.name) &&
      displayAttributes.has(String(value.name.value)) &&
      node(value.value) &&
      ['StringLiteral', 'JSXExpressionContainer'].includes(String(value.value.type))
    )
      texts = displayLiterals(
        value.value.type === 'JSXExpressionContainer' ? value.value.expression : value.value,
      );
    if (value.type === 'JSXExpressionContainer' && property === 'children' && node(value.expression))
      texts = displayLiterals(value.expression);
    for (const text of texts)
      if (words.test(text))
        issues.push(`${filename}: externalize displayed text ${JSON.stringify(text.trim())}`);
    for (const [key, item] of Object.entries(value)) visit(item, key);
  }
  visit(parseSync(source, { syntax: 'typescript', tsx: true }));
  return issues;
}

export function hardcodedCssIssues(source: string, filename: string) {
  return [...source.matchAll(/(?:^|[;{])\s*content\s*:\s*(["'])(.*?)\1/gsu)]
    .filter((match) =>
      words.test(
        match[2].replace(/\\([0-9a-f]{1,6})\s?/giu, (_, hex: string) =>
          String.fromCodePoint(Number.parseInt(hex, 16)),
        ),
      ),
    )
    .map((match) => `${filename}: externalize CSS display text ${JSON.stringify(match[2])}`);
}
