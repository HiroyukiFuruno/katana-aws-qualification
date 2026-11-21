import { type Ast, ast, type Binding, bind, type Path, type Source } from './ast.ts';
import { parameters } from './link.ts';

export function environmentKey(source: Source, key: string) {
  return `${source.path}:${key}`;
}

export function callArguments(node: Ast): Ast[] {
  if (!Array.isArray(node.arguments)) return [];
  return node.arguments.flatMap((value) => {
    if (typeof value !== 'object' || value === null || !('expression' in value)) return [];
    const expression = ast(value.expression);
    if (!expression) return [];
    return 'spread' in value && value.spread
      ? [{ type: 'SpreadElement', span: value.spread, expression }]
      : [expression];
  });
}

function restParameter(parameter: Ast) {
  return (parameter.type === 'Parameter' ? ast(parameter.pat) : parameter)?.type === 'RestElement';
}

function virtualArguments(values: Ast[], paths: Path[], origin: Ast | undefined): Ast {
  return {
    type: 'ArrayExpression',
    span: origin?.span ?? values[0]?.span,
    elements: values.flatMap((value, index) => {
      const expression = value.type === 'SpreadElement' ? ast(value.expression) : value;
      if (!expression) return [];
      const contextual = paths[index]?.length
        ? {
            type: 'ContextualExpression',
            span: origin?.span ?? expression.span,
            expression,
            path: paths[index],
          }
        : expression;
      return [
        {
          expression: contextual,
          spread: value.type === 'SpreadElement' ? (value.span ?? origin?.span) : null,
        },
      ];
    }),
  };
}

export function callEnvironment(
  target: { source: Source; node: Ast },
  caller: Source,
  values: Ast[],
  previous: Map<string, Binding[]>,
  paths: Path[] = [],
  origin?: Ast,
): Map<string, Binding[]> {
  const local: Source = { ...target.source, bindings: new Map() };
  const parametersForTarget = parameters(target.node);
  const virtual =
    parametersForTarget.some(restParameter) || values.some((value) => value.type === 'SpreadElement');
  const argumentsArray = virtualArguments(values, paths, origin);
  parametersForTarget.forEach((parameter, index) => {
    if (
      !restParameter(parameter) &&
      index >= values.length &&
      !values.some((value) => value.type === 'SpreadElement')
    )
      return;
    if (!virtual) {
      const value = values[index];
      if (value) bind(local, parameter, value, paths[index] ?? [], caller);
      return;
    }
    bind(
      local,
      parameter,
      argumentsArray,
      restParameter(parameter) ? [{ kind: 'array-rest', start: index }] : [String(index)],
      caller,
    );
  });
  const result = new Map(previous);
  for (const [key, bindings] of local.bindings) result.set(environmentKey(target.source, key), bindings);
  return result;
}
