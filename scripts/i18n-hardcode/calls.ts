import { type Ast, type Binding, bind, type Source } from './ast.ts';
import { parameters } from './link.ts';

export function environmentKey(source: Source, key: string) {
  return `${source.path}:${key}`;
}

export function callEnvironment(
  target: { source: Source; node: Ast },
  caller: Source,
  values: Ast[],
  previous: Map<string, Binding[]>,
): Map<string, Binding[]> {
  const local: Source = { ...target.source, bindings: new Map() };
  parameters(target.node).forEach((parameter, index) => {
    const argument = values[index];
    if (argument) bind(local, parameter, argument, [], caller);
  });
  const result = new Map(previous);
  for (const [key, bindings] of local.bindings) result.set(environmentKey(target.source, key), bindings);
  return result;
}
