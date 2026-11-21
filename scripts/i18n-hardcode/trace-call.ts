import {
  type Ast,
  args,
  ast,
  type Binding,
  name,
  type Origin,
  type Path,
  property,
  type Source,
  type Trace,
  type TraceOptions,
} from './ast.ts';
import { callEnvironment } from './calls.ts';
import { callable } from './link.ts';
import { translationCall } from './translation.ts';
import { errorObject, functionReturns } from './values.ts';

export function traceCall(
  sources: Source[],
  source: Source,
  node: Ast,
  path: Path,
  seen: Set<string>,
  recur: (value: Ast | undefined, nextPath?: Path) => Origin[],
  trace: Trace,
  environment: Map<string, Binding[]>,
  setEnvironment: (value: Map<string, Binding[]>) => void,
  options: TraceOptions,
): Origin[] {
  if (!options.resolveComposite && translationCall(source, node, environment))
    return args(node)
      .slice(1)
      .flatMap((argument) => [...recur(argument), ...recur(argument, ['*'])]);
  const callee = ast(node.callee);
  if (
    !options.resolveComposite &&
    name(callee) === 'String' &&
    errorObject(source, args(node)[0], new Set(), environment)
  )
    return [{ source, node, text: 'Untranslated String(error)', rawError: true }];
  const direct =
    name(callee) || (callee?.type === 'MemberExpression' ? property(ast(callee.property)) : '');
  if (!options.resolveComposite && ['String', 'useMemo', 'useCallback', 'useState'].includes(direct))
    return args(node)
      .slice(0, 1)
      .flatMap((argument) => recur(argument));
  if (!options.resolveComposite && callee?.type === 'MemberExpression') {
    const method = property(ast(callee.property));
    if (method === 'toString' && errorObject(source, ast(callee.object), new Set(), environment))
      return [{ source, node, text: 'Untranslated error.toString()', rawError: true }];
    if (['map', 'flatMap'].includes(method)) return args(node).flatMap((argument) => recur(argument));
    if (
      [
        'filter',
        'find',
        'slice',
        'concat',
        'join',
        'toUpperCase',
        'toLowerCase',
        'trim',
        'replace',
      ].includes(method)
    )
      return [
        ...recur(ast(callee.object), ['find', 'join'].includes(method) ? ['*', ...path] : path),
        ...(['concat', 'join', 'replace'].includes(method)
          ? args(node)
              .slice(method === 'replace' ? 1 : 0)
              .flatMap((argument) => recur(argument))
          : []),
      ];
  }
  let callableNode = callee;
  if (options.resolveComposite)
    while (callableNode?.type === 'ParenthesisExpression') callableNode = ast(callableNode.expression);
  const target = callable(sources, source, callableNode);
  if (!target) return options.resolveComposite ? [] : recur(callee);
  const previous = environment;
  setEnvironment(callEnvironment(target, source, args(node), previous));
  try {
    if (options.resolveComposite)
      return functionReturns(target.node, (value) => trace(target.source, value, path, seen, options));
    return trace(target.source, target.node, path, seen, options);
  } finally {
    setEnvironment(previous);
  }
}
