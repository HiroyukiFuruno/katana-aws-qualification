import { type Ast, ast, key, property, type Source } from './ast.ts';
import { resolveExport } from './exports.ts';
import { importedSource } from './sources.ts';

export function namespaceSource(
  sources: Source[],
  source: Source,
  node: Ast | undefined,
  seen = new Set<string>(),
): Source | undefined {
  if (!node) return undefined;
  const span = node.span as { start?: number } | undefined;
  const marker = `namespace:${source.path}:${span?.start}:${key(node)}`;
  if (seen.has(marker)) return undefined;
  const nextSeen = new Set(seen).add(marker);
  if (node.type === 'MemberExpression' || node.type === 'JSXMemberExpression') {
    const namespace = namespaceSource(sources, source, ast(node.object), nextSeen);
    const exported = namespace && resolveExport(sources, namespace, property(ast(node.property)));
    return exported ? namespaceSource(sources, exported.source, exported.node, nextSeen) : undefined;
  }
  if (node.type !== 'Identifier') return undefined;
  for (const binding of source.bindings.get(key(node)) ?? []) {
    if (binding.path.length) continue;
    const namespace = namespaceSource(sources, binding.source ?? source, binding.expression, nextSeen);
    if (namespace) return namespace;
  }
  const imported = source.imports.get(key(node));
  const target = imported && importedSource(sources, source, imported.source);
  if (!target || !imported) return undefined;
  if (imported.imported === '*') return target;
  const exported = resolveExport(sources, target, imported.imported);
  return exported ? namespaceSource(sources, exported.source, exported.node, nextSeen) : undefined;
}
