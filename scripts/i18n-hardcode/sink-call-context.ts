import {
  type Ast,
  ast,
  type Binding,
  type Origin,
  type Path,
  type Source,
  type Trace,
  walk,
} from './ast.ts';
import { callArguments, callEnvironment } from './calls.ts';
import { callable } from './link.ts';
import { createTrace } from './trace.ts';

type Target = { source: Source; node: Ast };
const functions = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration']);
const callerCache = new WeakMap<Source[], Map<Ast, { source: Source; node: Ast }[]>>();

function enclosingTarget(source: Source, node: Ast): Target | undefined {
  let current = source.parents.get(node);
  while (current && !functions.has(current.type)) current = source.parents.get(current);
  return current ? { source, node: current } : undefined;
}

function sameTarget(left: Target | undefined, right: Target) {
  return left?.source.path === right.source.path && left.node === right.node;
}

function callers(sources: Source[], target: Target) {
  const cached = callerCache.get(sources) ?? new Map<Ast, { source: Source; node: Ast }[]>();
  callerCache.set(sources, cached);
  const known = cached.get(target.node);
  if (known) return known;
  const output: { source: Source; node: Ast }[] = [];
  for (const source of sources)
    walk(source.ast, (node) => {
      if (
        node.type === 'CallExpression' &&
        sameTarget(callable(sources, source, ast(node.callee)), target)
      )
        output.push({ source, node });
    });
  cached.set(target.node, output);
  return output;
}

function callerContexts(
  sources: Source[],
  source: Source,
  node: Ast,
  seen: Set<string>,
): Map<string, Binding[]>[] {
  const target = enclosingTarget(source, node);
  if (!target) return [new Map()];
  const span = target.node.span as { start?: number } | undefined;
  const marker = `${target.source.path}:${span?.start}`;
  if (seen.has(marker)) return [];
  const nextSeen = new Set(seen).add(marker);
  return [
    new Map(),
    ...callers(sources, target).flatMap((call) =>
      callerContexts(sources, call.source, call.node, nextSeen).map((previous) =>
        callEnvironment(target, call.source, callArguments(call.node), previous, [], call.node),
      ),
    ),
  ];
}

export function sinkCallOrigins(
  sources: Source[],
  source: Source,
  node: Ast,
  path: Path,
  trace: Trace,
): Origin[] {
  const target = enclosingTarget(source, node);
  if (!target) return trace(source, node, path);
  const origins = trace(source, node, path);
  const contextual = callers(sources, target).flatMap((call) =>
    callerContexts(sources, call.source, call.node, new Set()).flatMap((previous) => {
      const environment = callEnvironment(
        target,
        call.source,
        callArguments(call.node),
        previous,
        [],
        call.node,
      );
      return createTrace(sources, environment)(source, node, path);
    }),
  );
  return [...origins, ...contextual];
}
