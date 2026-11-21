import { type Ast, ast, type Binding, key, nodes, type Origin, type Source, type Trace } from './ast.ts';
import { callEnvironment, environmentKey } from './calls.ts';
import { namespaceValues, resolveImport } from './exports.ts';
import { jsxValues } from './jsx.ts';
import { callable } from './link.ts';
import { traceMember } from './member.ts';
import { traceCall } from './trace-call.ts';
import { arrayValues, functionReturns, objectValues } from './values.ts';
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
      case 'CallExpression':
        return traceCall(sources, source, node, path, nextSeen, recur, trace, environment, (value) => {
          environment = value;
        });
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration': {
        return functionReturns(node, recur);
      }
      case 'JSXElement':
      case 'JSXFragment':
        return jsxValues(node, recur, (opening, props) => {
          const target = callable(sources, source, ast(opening.name));
          if (!target) return [];
          const previous = environment;
          environment = callEnvironment(target, source, [props], previous);
          try {
            return trace(target.source, target.node, path, nextSeen);
          } finally {
            environment = previous;
          }
        });
      default:
        return [];
    }
  };
  return trace;
}
