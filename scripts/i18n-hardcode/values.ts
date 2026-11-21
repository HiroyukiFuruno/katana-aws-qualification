import {
  type Ast,
  ast,
  type Binding,
  key,
  name,
  nodes,
  type Origin,
  type Path,
  property,
  type Source,
  walk,
} from './ast.ts';
import { environmentKey } from './calls.ts';
import { technicalIdentifier } from './computed.ts';

type Recur = (node: Ast | undefined, path: Path) => Origin[];

export { arrayValues } from './array-values.ts';

export function combineOrigins(source: Source, node: Ast, left: Origin[], right: Origin[]): Origin[] {
  return left.flatMap((first) =>
    right.map((second) => ({ source, node, text: `${first.text}${second.text}` })),
  );
}

export function templateValues(
  source: Source,
  node: Ast,
  recur: (value: Ast | undefined, path?: Path) => Origin[],
): Origin[] {
  const parts: Origin[][] = [];
  const quasis = nodes(node.quasis);
  const expressions = nodes(node.expressions);
  for (let index = 0; index < quasis.length; index++) {
    parts.push(recur(quasis[index]));
    if (index < expressions.length) parts.push(recur(expressions[index]));
  }
  return parts.reduce<Origin[]>(
    (combined, part) => (combined.length ? combineOrigins(source, node, combined, part) : []),
    [{ source, node, text: '' }],
  );
}

export function objectValues(
  node: Ast,
  path: Path,
  recur: Recur,
  resolveScalarProperty = false,
): Origin[] {
  let [head, ...rest] = path;
  const excluded = new Set<string>();
  while (head && typeof head !== 'string') {
    if (head.kind !== 'object-rest') return [];
    for (const field of head.excluded) excluded.add(field);
    [head, ...rest] = rest;
  }
  if (!head) return [];
  return nodes(node.properties).flatMap((member) => {
    if (member.type === 'SpreadElement') return recur(ast(member.arguments), path);
    const memberKey = property(ast(member.key)) || name(member);
    if (excluded.has(memberKey)) return [];
    if (head !== '*' && head !== memberKey) return [];
    if (!rest.length && !resolveScalarProperty && technicalIdentifier(memberKey, ast(member.value)))
      return [];
    return recur(member.type === 'Identifier' ? member : ast(member.value), rest);
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
