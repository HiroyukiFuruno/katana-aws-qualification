export type Ast = { type: string; [key: string]: unknown };
export type Binding = { expression: Ast; path: string[]; source?: Source };
export type Source = {
  path: string;
  text: string;
  ast: Ast;
  bindings: Map<string, Binding[]>;
  imports: Map<string, { source: string; imported: string }>;
  exports: Map<string, Ast>;
  parents: WeakMap<Ast, Ast>;
  errors: Set<string>;
};
export type Origin = { source: Source; node: Ast; text: string; rawError?: boolean };
export type Trace = (
  source: Source,
  node: Ast | undefined,
  path?: string[],
  seen?: Set<string>,
) => Origin[];

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
  path: string[] = [],
  origin?: Source,
) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    const existing = source.bindings.get(key(pattern)) ?? [];
    existing.push({ expression, path, source: origin });
    source.bindings.set(key(pattern), existing);
  } else if (pattern.type === 'ObjectPattern') {
    for (const member of nodes(pattern.properties)) {
      const memberKey = property(ast(member.key));
      if (member.type === 'AssignmentPatternProperty') {
        bind(source, ast(member.key), expression, [...path, memberKey], origin);
        const fallback = ast(member.value);
        if (fallback) bind(source, ast(member.key), fallback, [], source);
      } else
        bind(source, ast(member.value) ?? ast(member.key), expression, [...path, memberKey], origin);
    }
  } else if (pattern.type === 'ArrayPattern') {
    nodes(pattern.elements).forEach((element, index) => {
      bind(source, element, expression, [...path, `${index}`], origin);
    });
  } else if (pattern.type === 'AssignmentPattern')
    bind(source, ast(pattern.left), expression, path, origin);
}

export function prose(value: string): boolean {
  const text = value.trim();
  if (!text || !/\p{L}/u.test(text)) return false;
  return !/^(?:(?:https?:\/\/|mailto:|tel:)\S+|\/\S*|#[\w-]+)$/.test(text);
}
