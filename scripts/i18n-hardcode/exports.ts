import { type Ast, key, type ModuleBinding, type Source } from './ast.ts';
import { importedSource } from './sources.ts';

type Export = { source: Source; node: Ast };

export function resolveExport(
  sources: Source[],
  source: Source,
  name: string,
  seen = new Set<string>(),
): Export | undefined {
  const marker = `${source.path}:${name}`;
  if (seen.has(marker)) return undefined;
  const nextSeen = new Set(seen).add(marker);
  const reexport = source.reexports.get(name);
  if (reexport) return resolveBinding(sources, source, reexport, nextSeen);
  const direct = source.exports.get(name);
  if (direct) {
    const imported = source.imports.get(key(direct));
    return imported ? resolveBinding(sources, source, imported, nextSeen) : { source, node: direct };
  }
  if (name === 'default') return undefined;
  const candidates = new Map<string, Export>();
  for (const specifier of source.exportStars) {
    const target = importedSource(sources, source, specifier);
    const candidate = target && resolveExport(sources, target, name, nextSeen);
    if (candidate) {
      const span = candidate.node.span as { start?: number } | undefined;
      const identity =
        candidate.node.type === 'ModuleNamespace'
          ? `namespace:${candidate.source.path}`
          : `${candidate.source.path}:${span?.start}:${key(candidate.node)}`;
      candidates.set(identity, candidate);
    }
  }
  return candidates.size === 1 ? candidates.values().next().value : undefined;
}

function resolveBinding(
  sources: Source[],
  source: Source,
  binding: ModuleBinding,
  seen: Set<string>,
): Export | undefined {
  const target = importedSource(sources, source, binding.source);
  if (!target) return undefined;
  if (binding.imported === '*')
    return { source: target, node: { type: 'ModuleNamespace', span: target.ast.span } };
  return resolveExport(sources, target, binding.imported, seen);
}
