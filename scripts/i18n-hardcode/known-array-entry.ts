import { type Ast, ast, key, property, type Source } from './ast.ts';

export type KnownArrayEntry = { node: Ast; source: Source };

export function knownObjectMember(value: KnownArrayEntry, memberName: string) {
  if (value.node.type !== 'ObjectExpression') return undefined;
  const properties = Array.isArray(value.node.properties) ? value.node.properties : [];
  let node: Ast | undefined;
  for (const entry of properties) {
    const propertyNode = ast(entry);
    if (propertyNode?.type !== 'KeyValueProperty') return undefined;
    const keyName = property(ast(propertyNode.key));
    if (keyName === '*') return undefined;
    if (keyName === memberName) node = ast(propertyNode.value);
  }
  return node ? { node, source: value.source } : undefined;
}

export function knownMappedValue(source: Source, callback: Ast | undefined, value: KnownArrayEntry) {
  if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type))
    return undefined;
  const body = ast(callback.body);
  const parameter = Array.isArray(callback.params) ? ast(callback.params[0]) : undefined;
  if (body?.type === 'Identifier' && parameter?.type === 'Identifier' && key(body) === key(parameter))
    return value;
  if (body?.type === 'MemberExpression' && parameter?.type === 'Identifier') {
    const object = ast(body.object);
    const memberName = property(ast(body.property));
    if (object?.type === 'Identifier' && key(object) === key(parameter) && memberName !== '*')
      return knownObjectMember(value, memberName);
  }
  return body && ['NullLiteral', 'BooleanLiteral', 'NumericLiteral', 'StringLiteral'].includes(body.type)
    ? { node: body, source }
    : undefined;
}
