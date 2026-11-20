import { type Ast, key, type Source } from './ast.ts';
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
  const direct = source.exports.get(name);
  if (direct) {
    const imported = source.imports.get(key(direct));
    if (imported?.imported === '*') return { source, node: direct };
    const target = imported && importedSource(sources, source, imported.source);
    return target && imported
      ? resolveExport(sources, target, imported.imported, nextSeen)
      : { source, node: direct };
  }
  if (name === 'default') return undefined;
  const candidates = new Map<string, Export>();
  for (const specifier of source.exportStars) {
    const target = importedSource(sources, source, specifier);
    const candidate = target && resolveExport(sources, target, name, nextSeen);
    if (candidate) {
      const span = candidate.node.span as { start?: number } | undefined;
      const imported = candidate.source.imports.get(key(candidate.node));
      const namespace =
        imported?.imported === '*' && importedSource(sources, candidate.source, imported.source);
      const identity = namespace
        ? `namespace:${namespace.path}`
        : `${candidate.source.path}:${span?.start}:${key(candidate.node)}`;
      candidates.set(identity, candidate);
    }
  }
  return candidates.size === 1 ? candidates.values().next().value : undefined;
}
