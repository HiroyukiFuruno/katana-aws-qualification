import { type Ast, ast, type Trace } from './ast.ts';

const textualAriaAttributes = [
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
] as const;

const textualDomProperties = [
  'alt',
  'ariaLabel',
  'ariaDescription',
  'ariaPlaceholder',
  'ariaRoleDescription',
  'ariaValueText',
] as const;

export const textualSpreadProperties = [
  'label',
  'title',
  'placeholder',
  ...textualDomProperties,
  ...textualAriaAttributes,
  'text',
  'message',
] as const;

export function isTextualAriaAttribute(value: string): boolean {
  return (textualAriaAttributes as readonly string[]).includes(value);
}

export function isTextualDomProperty(value: string): boolean {
  return (textualDomProperties as readonly string[]).includes(value);
}

export function sinkNames(trace: Trace, node: Ast | undefined): string[] {
  const expression = node?.type === 'Computed' ? ast(node.expression) : node;
  return [...new Set(trace(expression).map((origin) => origin.text.trim()))];
}
