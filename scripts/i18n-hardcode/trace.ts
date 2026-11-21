import {
  type Ast,
  args,
  ast,
  type Binding,
  key,
  name,
  nodes,
  type Origin,
  property,
  type Source,
  type Trace,
} from './ast.ts';
import { callEnvironment, environmentKey } from './calls.ts';
import { namespaceValues, resolveImport } from './exports.ts';
import { callable } from './link.ts';
import { mappedPaths } from './mapped-path.ts';
import { traceMember } from './member.ts';
import { translationCall } from './translation.ts';
import { arrayValues, errorObject, functionReturns, objectValues } from './values.ts';
export function createTrace(sources: Source[]): Trace {
  let environment = new Map<string, Binding[]>();
  const trace: Trace = (source, node, path = [], seen = new Set()) => {
    if (!node) return [];
    const span = node.span as { start?: number; end?: number } | undefined;
    const marker = `${source.path}:${span?.start}:${span?.end}:${node.type}:${JSON.stringify(path)}`;
    if (seen.has(marker)) return [];
    const nextSeen = new Set(seen).add(marker);
    const recur = (value: Ast | undefined, nextPath = path) => trace(source, value, nextPath, nextSeen);
    const emit = (text: string): Origin[] => (path.length ? [] : [{ source, node, text }]);
    switch (node.type) {
      case 'StringLiteral':
      case 'JSXText':
        return emit(String(node.value ?? ''));
      case 'TemplateElement':
        return emit(String(node.cooked ?? node.raw ?? ''));
      case 'TemplateLiteral':
        return [...nodes(node.quasis), ...nodes(node.expressions)].flatMap((part) => recur(part));
      case 'ParenthesisExpression':
      case 'TsAsExpression':
      case 'TsSatisfiesExpression':
      case 'TsNonNullExpression':
      case 'JSXExpressionContainer':
      case 'TsTypeAssertion':
      case 'TsConstAssertion':
        return recur(ast(node.expression));
      case 'OptionalChainingExpression':
        return recur(ast(node.base));
      case 'ModuleNamespace': {
        return namespaceValues(sources, source, path, trace, nextSeen);
      }
      case 'Identifier': {
        const bindings =
          environment.get(environmentKey(source, key(node))) ?? source.bindings.get(key(node)) ?? [];
        const local = bindings.flatMap((binding) =>
          trace(binding.source ?? source, binding.expression, [...binding.path, ...path], nextSeen),
        );
        const imported = source.imports.get(key(node));
        const exported = imported && resolveImport(sources, source, imported);
        return [...local, ...(exported ? trace(exported.source, exported.node, path, nextSeen) : [])];
      }
      case 'MemberExpression':
        return traceMember(source, node, path, recur, trace, nextSeen, environment);
      case 'ObjectExpression':
        return objectValues(node, path, recur);
      case 'ArrayExpression':
        return arrayValues(node, path, recur);
      case 'ConditionalExpression':
        return [...recur(ast(node.consequent)), ...recur(ast(node.alternate))];
      case 'BinaryExpression': {
        if (!['+', '||', '??', '&&'].includes(String(node.operator))) return [];
        return [...(node.operator === '&&' ? [] : recur(ast(node.left))), ...recur(ast(node.right))];
      }
      case 'CallExpression': {
        if (translationCall(source, node, environment))
          return args(node)
            .slice(1)
            .flatMap((argument) => [...recur(argument), ...recur(argument, ['*'])]);
        const callee = ast(node.callee);
        if (name(callee) === 'String' && errorObject(source, args(node)[0], new Set(), environment)) {
          return [{ source, node, text: 'Untranslated String(error)', rawError: true }];
        }
        const direct =
          name(callee) || (callee?.type === 'MemberExpression' ? property(ast(callee.property)) : '');
        if (['String', 'useMemo', 'useCallback', 'useState'].includes(direct))
          return args(node)
            .slice(0, 1)
            .flatMap((argument) => recur(argument));
        if (callee?.type === 'MemberExpression') {
          const method = property(ast(callee.property));
          if (method === 'toString' && errorObject(source, ast(callee.object), new Set(), environment))
            return [{ source, node, text: 'Untranslated error.toString()', rawError: true }];
          if (['map', 'flatMap'].includes(method))
            return args(node)
              .slice(0, 1)
              .flatMap((argument) =>
                mappedPaths(path, method === 'flatMap').flatMap((selected) => recur(argument, selected)),
              );
          if (method === 'concat')
            return [
              ...recur(ast(callee.object), path),
              ...args(node).flatMap((argument) =>
                mappedPaths(path, true).flatMap((selected) => recur(argument, selected)),
              ),
            ];
          if (
            [
              'filter',
              'find',
              'slice',
              'join',
              'toUpperCase',
              'toLowerCase',
              'trim',
              'replace',
            ].includes(method)
          ) {
            return [
              ...recur(ast(callee.object), ['find', 'join'].includes(method) ? ['*', ...path] : path),
              ...(['join', 'replace'].includes(method)
                ? args(node)
                    .slice(method === 'replace' ? 1 : 0)
                    .flatMap((argument) => recur(argument))
                : []),
            ];
          }
        }
        const target = callable(sources, source, callee);
        if (target) {
          const previous = environment;
          environment = callEnvironment(target, source, args(node), previous);
          try {
            return trace(target.source, target.node, path, nextSeen);
          } finally {
            environment = previous;
          }
        }
        return recur(callee);
      }
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration': {
        return functionReturns(node, recur);
      }
      default:
        return [];
    }
  };
  return trace;
}
