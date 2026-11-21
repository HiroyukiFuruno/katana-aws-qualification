import {
  type Ast,
  ast,
  type Binding,
  key,
  nodes,
  type Origin,
  type Path,
  type Source,
  type Trace,
} from './ast.ts';
import { callEnvironment, environmentKey } from './calls.ts';
import { namespaceValues, resolveImport } from './exports.ts';
import { jsxValues } from './jsx.ts';
import { callable } from './link.ts';
import { traceMember } from './member.ts';
import { traceCall } from './trace-call.ts';
import { contextKey } from './trace-context.ts';
import { arrayValues, combineOrigins, functionReturns, objectValues, templateValues } from './values.ts';

export function createTrace(sources: Source[]): Trace {
  let environment = new Map<string, Binding[]>();
  const trace: Trace = (source, node, path = [], seen = new Set(), options = {}) => {
    if (!node) return [];
    const span = node.span as { start?: number; end?: number } | undefined;
    const pathKey = ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(
      node.type,
    )
      ? ''
      : JSON.stringify(path);
    const marker = `${source.path}:${span?.start}:${span?.end}:${node.type}:${pathKey}:${contextKey(environment)}`;
    if (seen.has(marker)) return [];
    const nextSeen = new Set(seen).add(marker);
    const recur = (value: Ast | undefined, nextPath = path) =>
      trace(source, value, nextPath, nextSeen, options);
    const emit = (text: string): Origin[] => (path.length ? [] : [{ source, node, text }]);
    const setEnvironment = (value: Map<string, Binding[]>) => {
      environment = value;
    };
    switch (node.type) {
      case 'StringLiteral':
      case 'JSXText':
        return emit(String(node.value ?? ''));
      case 'TemplateElement':
        return emit(String(node.cooked ?? node.raw ?? ''));
      case 'TemplateLiteral':
        if (options.resolveComposite) return templateValues(source, node, recur);
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
      case 'ContextualExpression': {
        const selection = Array.isArray(node.path) ? (node.path as Path) : [];
        return trace(source, ast(node.expression), [...selection, ...path], nextSeen, options);
      }
      case 'ModuleNamespace':
        return namespaceValues(sources, source, path, trace, nextSeen, options);
      case 'Identifier': {
        const bindings =
          environment.get(environmentKey(source, key(node))) ?? source.bindings.get(key(node)) ?? [];
        const local = bindings.flatMap((binding) =>
          trace(
            binding.source ?? source,
            binding.expression,
            [...binding.path, ...path],
            nextSeen,
            options,
          ),
        );
        const imported = source.imports.get(key(node));
        const exported = imported && resolveImport(sources, source, imported);
        return [
          ...local,
          ...(exported ? trace(exported.source, exported.node, path, nextSeen, options) : []),
        ];
      }
      case 'MemberExpression':
        return traceMember(source, node, path, recur, trace, nextSeen, environment, options);
      case 'ObjectExpression':
        return objectValues(node, path, recur);
      case 'ArrayExpression':
        if (options.resolveComposite && !path.length) return [];
        return arrayValues(node, path, recur);
      case 'ConditionalExpression':
        return [...recur(ast(node.consequent)), ...recur(ast(node.alternate))];
      case 'BinaryExpression': {
        if (!['+', '||', '??', '&&'].includes(String(node.operator))) return [];
        if (options.resolveComposite && node.operator === '+')
          return combineOrigins(source, node, recur(ast(node.left)), recur(ast(node.right)));
        return [...(node.operator === '&&' ? [] : recur(ast(node.left))), ...recur(ast(node.right))];
      }
      case 'CallExpression':
        return traceCall(
          sources,
          source,
          node,
          path,
          nextSeen,
          recur,
          trace,
          environment,
          setEnvironment,
          options,
        );
      case 'JSXElement':
      case 'JSXFragment':
        return options.resolveComposite
          ? []
          : jsxValues(node, recur, (opening, props) => {
              const target = callable(sources, source, ast(opening.name));
              if (!target) return [];
              const previous = environment;
              environment = callEnvironment(target, source, [props], previous, [], opening);
              try {
                return trace(target.source, target.node, path, nextSeen, options);
              } finally {
                environment = previous;
              }
            });
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        if (options.resolveComposite) {
          if (!options.invokeFunction) return [];
          return functionReturns(node, (value) =>
            trace(source, value, path, nextSeen, { ...options, invokeFunction: false }),
          );
        }
        return functionReturns(node, recur);
      default:
        return [];
    }
  };
  return trace;
}
