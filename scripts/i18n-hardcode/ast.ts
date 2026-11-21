import { patternTargets } from './patterns.ts';

export type Ast = { type: string; [key: string]: unknown };
export type Path = (
  | string
  | { kind: 'array-rest'; start: number }
  | { kind: 'object-rest'; excluded: string[] }
)[];
export type Binding = { expression: Ast; path: Path; source?: Source };
export type ModuleBinding = { source: string; imported: string };
export type Source = {
  path: string;
  text: string;
  ast: Ast;
  bindings: Map<string, Binding[]>;
  imports: Map<string, ModuleBinding>;
  reexports: Map<string, ModuleBinding>;
  exports: Map<string, Ast>;
  exportStars: string[];
  parents: WeakMap<Ast, Ast>;
  errors: Set<string>;
};
export type Origin = { source: Source; node: Ast; text: string; rawError?: boolean };
export type Trace = (source: Source, node: Ast | undefined, path?: Path, seen?: Set<string>) => Origin[];

export function ast(value: unknown): Ast | undefined {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
    ? (value as Ast)
    : undefined;
}

export function nodes(value: unknown): Ast[] {
  return Array.isArray(value) ? value.flatMap((item) => ast(item) ?? []) : [];
}

export function walk(node: Ast, visit: (node: Ast, parent?: Ast) => boolean | undefined, parent?: Ast) {
  if (visit(node, parent) === false) return;
  for (const value of Object.values(node)) {
    const child = ast(value);
    if (child) walk(child, visit, node);
    else if (Array.isArray(value)) {
      for (const entry of value) {
        const direct = ast(entry);
        if (direct) walk(direct, visit, node);
        else if (typeof entry === 'object' && entry !== null) {
          for (const nested of Object.values(entry)) {
            const child = ast(nested);
            if (child) walk(child, visit, node);
          }
        }
      }
    }
  }
}

export function name(node: Ast | undefined): string {
  if (!node) return '';
  return typeof node.value === 'string' ? node.value : '';
}

export function key(node: Ast): string {
  return `${name(node)}:${node.ctxt ?? 0}`;
}

export function args(node: Ast): Ast[] {
  if (!Array.isArray(node.arguments)) return [];
  return node.arguments.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return [];
    return ast('expression' in value ? value.expression : undefined) ?? [];
  });
}

export function property(node: Ast | undefined): string {
  if (node?.type === 'Computed') {
    const expression = ast(node.expression);
    return expression && ['StringLiteral', 'NumericLiteral'].includes(expression.type)
      ? String(expression.value)
      : '*';
  }
  return name(node);
}

export function bind(
  source: Source,
  pattern: Ast | undefined,
  expression: Ast,
  path: Path = [],
  origin?: Source,
) {
  for (const target of patternTargets(pattern, path)) {
    const existing = source.bindings.get(key(target.identifier)) ?? [];
    existing.push({ expression, path: target.path, source: origin });
    if (target.fallback) existing.push({ expression: target.fallback, path: [], source });
    source.bindings.set(key(target.identifier), existing);
  }
}

export function prose(value: string): boolean {
  const text = value.trim();
  if (!text || !/\p{L}/u.test(text)) return false;
  return !/^(?:(?:https?:\/\/|mailto:|tel:)\S+|\/\S*|#[\w-]+)$/.test(text);
}
