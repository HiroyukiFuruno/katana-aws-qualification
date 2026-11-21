import { type Ast, ast, bind, key, nodes, property, type Source, walk } from './ast.ts';
import { resolveExport } from './exports.ts';
import { namespaceSource } from './namespace.ts';
import { importedSource } from './sources.ts';

export function callable(
  sources: Source[],
  source: Source,
  node: Ast | undefined,
  seen = new Set<string>(),
): { source: Source; node: Ast } | undefined {
  if (!node) return undefined;
  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type))
    return { source, node };
  if (node.type === 'MemberExpression' || node.type === 'JSXMemberExpression') {
    const namespace = namespaceSource(sources, source, ast(node.object));
    const exported = namespace && resolveExport(sources, namespace, property(ast(node.property)));
    return exported ? callable(sources, exported.source, exported.node, seen) : undefined;
  }
  if (node.type !== 'Identifier') return undefined;
  const marker = `${source.path}:${key(node)}`;
  if (seen.has(marker)) return undefined;
  seen.add(marker);
  for (const binding of source.bindings.get(key(node)) ?? []) {
    if (binding.path.length) continue;
    const result = callable(sources, binding.source ?? source, binding.expression, seen);
    if (result) return result;
  }
  const imported = source.imports.get(key(node));
  const target = imported && importedSource(sources, source, imported.source);
  const exported = target && imported && resolveExport(sources, target, imported.imported);
  return exported ? callable(sources, exported.source, exported.node, seen) : undefined;
}

export function parameters(node: Ast) {
  return nodes(node.params);
}

export function linkSources(sources: Source[]) {
  for (const source of sources)
    walk(source.ast, (node) => {
      if (node.type !== 'JSXOpeningElement') return;
      const target = callable(sources, source, ast(node.name));
      const parameter = target && parameters(target.node)[0];
      if (!target || !parameter) return;
      const properties = nodes(node.attributes).flatMap((attribute) => {
        if (attribute.type === 'SpreadElement') return [attribute];
        if (attribute.type !== 'JSXAttribute') return [];
        const value = ast(attribute.value);
        if (!value) return [];
        return [{ type: 'KeyValueProperty', key: ast(attribute.name), value }];
      });
      bind(
        target.source,
        parameter,
        { type: 'ObjectExpression', span: node.span, properties },
        [],
        source,
      );
    });
}

export function displayProp(value: string): boolean {
  return /^(?:aria-label|aria-description|alt|title|placeholder|label|children|text|message|description|heading|caption|subtitle|buttonLabel|emptyMessage|errorMessage)$/.test(
    value,
  );
}
