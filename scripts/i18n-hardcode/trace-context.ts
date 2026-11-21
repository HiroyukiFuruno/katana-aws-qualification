import type { Binding } from './ast.ts';

export function contextKey(environment: Map<string, Binding[]>) {
  return [...environment]
    .map(
      ([scope, bindings]) =>
        `${scope}:${bindings
          .map((binding) => {
            const span = binding.expression.span as { start?: number; end?: number } | undefined;
            return `${binding.source?.path ?? ''}:${span?.start}:${span?.end}:${JSON.stringify(binding.path)}`;
          })
          .join(',')}`,
    )
    .sort()
    .join(';');
}
