import { filterPaths, slicePaths } from './array-selector.ts';
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
} from './ast.ts';
import { callArguments, callEnvironment } from './calls.ts';
import { knownArrayIndexOccupied } from './concat-index.ts';
import { knownSelectedArrayValues } from './known-array-values.ts';
import { callable } from './link.ts';
import { mapInputPath, mappedPaths } from './mapped-path.ts';
import { translationCall } from './translation.ts';
import { errorObject } from './values.ts';

function selectsArray(path: Path) {
  const head = path[0];
  return (
    head === undefined ||
    head === '*' ||
    (typeof head === 'string' && /^(0|[1-9][0-9]*)$/.test(head)) ||
    (typeof head === 'object' && ['array-filter', 'array-range', 'array-rest'].includes(head.kind))
  );
}

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
): Origin[] {
  if (translationCall(source, node, environment))
    return args(node)
      .slice(1)
      .flatMap((argument) => [...recur(argument), ...recur(argument, ['*'])]);
  const callee = ast(node.callee);
  if (name(callee) === 'String' && errorObject(source, args(node)[0], new Set(), environment))
    return [{ source, node, text: 'Untranslated String(error)', rawError: true }];
  const direct =
    name(callee) || (callee?.type === 'MemberExpression' ? property(ast(callee.property)) : '');
  if (['String', 'useMemo', 'useCallback', 'useState'].includes(direct))
    return args(node)
      .slice(0, 1)
      .flatMap((argument) => recur(argument));
  if (callee?.type === 'MemberExpression') {
    const method = property(ast(callee.property));
    if (['filter', 'map', 'slice'].includes(method)) {
      const known = knownSelectedArrayValues(source, node, path, environment);
      if (known !== undefined)
        return known.flatMap((value) => trace(value.source, value.node, [], seen));
    }
    if (method === 'toString' && errorObject(source, ast(callee.object), new Set(), environment))
      return [{ source, node, text: 'Untranslated error.toString()', rawError: true }];
    if (['map', 'flatMap'].includes(method)) {
      const target = callable(sources, source, args(node)[0]);
      const collection = ast(callee.object);
      if (target && collection)
        return mappedPaths(path, method === 'flatMap').flatMap((selected) => {
          const previous = environment;
          const selection = method === 'map' ? mapInputPath(path) : ['*'];
          setEnvironment(callEnvironment(target, source, [collection], previous, [selection], node));
          try {
            return trace(target.source, target.node, selected, seen);
          } finally {
            setEnvironment(previous);
          }
        });
    }
    if (method === 'flatMap')
      return args(node)
        .slice(0, 1)
        .flatMap((argument) => mappedPaths(path, true).flatMap((selected) => recur(argument, selected)));
    if (method === 'concat')
      return [
        ...recur(ast(callee.object), path),
        ...(knownArrayIndexOccupied(source, ast(callee.object), path, environment)
          ? []
          : args(node).flatMap((argument) =>
              mappedPaths(path, true).flatMap((selected) => recur(argument, selected)),
            )),
      ];
    if (method === 'slice')
      return selectsArray(path)
        ? slicePaths(node, path).flatMap((selected) => recur(ast(callee.object), selected))
        : recur(ast(callee.object), path);
    if (method === 'filter')
      return selectsArray(path)
        ? filterPaths(node, path).flatMap((selected) => recur(ast(callee.object), selected))
        : recur(ast(callee.object), path);
    if (['find', 'join', 'toUpperCase', 'toLowerCase', 'trim', 'replace'].includes(method))
      return [
        ...recur(ast(callee.object), ['find', 'join'].includes(method) ? ['*', ...path] : path),
        ...(['join', 'replace'].includes(method)
          ? args(node)
              .slice(method === 'replace' ? 1 : 0)
              .flatMap((argument) => recur(argument))
          : []),
      ];
  }
  const target = callable(sources, source, callee);
  if (!target) return recur(callee);
  const previous = environment;
  setEnvironment(callEnvironment(target, source, callArguments(node), previous, [], node));
  try {
    return trace(target.source, target.node, path, seen);
  } finally {
    setEnvironment(previous);
  }
}
