import { type Ast, ast, type Binding, key, name, type Source } from './ast.ts';
import { environmentKey } from './calls.ts';

export function translationCall(
  source: Source,
  node: Ast,
  environment = new Map<string, Binding[]>(),
): boolean {
  if (node.type !== 'CallExpression') return false;
  return translator(source, ast(node.callee), new Set(), environment);
}

function translator(
  source: Source,
  node: Ast | undefined,
  seen: Set<string>,
  environment: Map<string, Binding[]>,
): boolean {
  if (!node) return false;
  const id = key(node);
  if (seen.has(id)) return false;
  seen.add(id);
  if (node.type === 'MemberExpression' && name(ast(node.property)) === 't') {
    return preferences(source, ast(node.object), new Set(), environment);
  }
  if (node.type !== 'Identifier') return false;
  return (environment.get(environmentKey(source, id)) ?? source.bindings.get(id) ?? []).some(
    (binding) => {
      const origin = binding.source ?? source;
      if (binding.path.join('.') === 't')
        return preferences(origin, binding.expression, new Set(), environment);
      return binding.path.length === 0 && translator(origin, binding.expression, seen, environment);
    },
  );
}

function preferences(
  source: Source,
  node: Ast | undefined,
  seen: Set<string>,
  environment: Map<string, Binding[]>,
): boolean {
  if (!node) return false;
  if (node.type === 'CallExpression') {
    const callee = ast(node.callee);
    const imported = callee ? source.imports.get(key(callee)) : undefined;
    return (
      imported?.imported === 'usePreferences' && /(?:^|\/)preferences(?:\.tsx?)?$/.test(imported.source)
    );
  }
  if (node.type !== 'Identifier' || seen.has(key(node))) return false;
  seen.add(key(node));
  return (
    environment.get(environmentKey(source, key(node))) ??
    source.bindings.get(key(node)) ??
    []
  ).some((binding) => preferences(binding.source ?? source, binding.expression, seen, environment));
}
