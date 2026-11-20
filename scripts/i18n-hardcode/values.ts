import {
  type Ast,
  ast,
  type Binding,
  key,
  name,
  nodes,
  type Origin,
  property,
  type Source,
  walk,
} from './ast.ts';
import { environmentKey } from './calls.ts';
import { technicalIdentifier } from './computed.ts';

type Recur = (node: Ast | undefined, path: string[]) => Origin[];

export function objectValues(node: Ast, path: string[], recur: Recur): Origin[] {
  const [head, ...rest] = path;
  if (!head) return [];
  return nodes(node.properties).flatMap((member) => {
    if (member.type === 'SpreadElement') return recur(ast(member.arguments), path);
    const memberKey = property(ast(member.key)) || name(member);
    if (head !== '*' && head !== memberKey) return [];
    if (!rest.length && technicalIdentifier(memberKey, ast(member.value))) return [];
    return recur(member.type === 'Identifier' ? member : ast(member.value), rest);
  });
}

export function arrayValues(node: Ast, path: string[], recur: Recur): Origin[] {
  if (!Array.isArray(node.elements)) return [];
  const [head = '*', ...rest] = path;
  return node.elements.flatMap((entry, index) => {
    if (head !== '*' && head !== String(index)) return [];
    if (typeof entry !== 'object' || entry === null || !('expression' in entry)) return [];
    return recur(ast(entry.expression), rest);
  });
}

export function errorObject(
  source: Source,
  node: Ast | undefined,
  seen = new Set<string>(),
  environment = new Map<string, Binding[]>(),
): boolean {
  if (!node) return false;
  if (/error|failure|cause|caught/i.test(name(node))) return true;
  if (node.type === 'NewExpression') return /Error$/.test(name(ast(node.callee)));
  if (node.type === 'MemberExpression') {
    return (
      errorObject(source, ast(node.object), seen, environment) ||
      errorObject(source, ast(node.property), seen, environment)
    );
  }
  if (node.type !== 'Identifier' || seen.has(key(node))) return false;
  if (source.errors.has(key(node))) return true;
  seen.add(key(node));
  return (
    environment.get(environmentKey(source, key(node))) ??
    source.bindings.get(key(node)) ??
    []
  ).some((binding) => errorObject(binding.source ?? source, binding.expression, seen, environment));
}

export function knownObjectMember(
  source: Source,
  node: Ast | undefined,
  member: string,
  seen = new Set<string>(),
  environment = new Map<string, Binding[]>(),
): boolean {
  if (!node) return false;
  if (node.type === 'ObjectExpression')
    return nodes(node.properties).some((value) => property(ast(value.key)) === member);
  if (node.type !== 'Identifier' || seen.has(key(node))) return false;
  seen.add(key(node));
  return (
    environment.get(environmentKey(source, key(node))) ??
    source.bindings.get(key(node)) ??
    []
  ).some((binding) =>
    knownObjectMember(binding.source ?? source, binding.expression, member, seen, environment),
  );
}

export function functionReturns(node: Ast, recur: (node: Ast | undefined) => Origin[]): Origin[] {
  const body = ast(node.body);
  if (!body) return [];
  if (!['BlockStatement', 'FunctionBody'].includes(body.type)) return recur(body);
  const values: Origin[] = [];
  walk(body, (part) => {
    if (['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(part.type))
      return false;
    if (part.type === 'ReturnStatement') values.push(...recur(ast(part.argument)));
  });
  return values;
}
