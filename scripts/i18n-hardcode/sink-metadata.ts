import { type Ast, ast, type Origin, type Path, type TraceOptions } from './ast.ts';

type SinkTrace = (
  node: Ast | undefined,
  path?: Path,
  seen?: Set<string>,
  options?: TraceOptions,
) => Origin[];

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
  'children',
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

export function sinkNames(trace: SinkTrace, node: Ast | undefined): string[] {
  const expression = node?.type === 'Computed' ? ast(node.expression) : node;
  return [
    ...new Set(
      trace(expression, [], undefined, { resolveComposite: true }).map((origin) => origin.text),
    ),
  ];
}
