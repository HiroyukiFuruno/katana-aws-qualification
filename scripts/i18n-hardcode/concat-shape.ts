import { type Ast, ast, property } from './ast.ts';

function plainDataProperty(entry: unknown) {
  const member = ast(entry);
  if (member?.type !== 'KeyValueProperty') return false;
  const memberKey = ast(member.key);
  return (
    memberKey?.type !== 'Computed' && property(memberKey) !== '*' && property(memberKey) !== '__proto__'
  );
}

export function scalarConcatArgument(node: Ast) {
  if (/^(String|Numeric|Boolean|Null|Template)Literal$/.test(node.type)) return true;
  return (
    node.type === 'ObjectExpression' &&
    Array.isArray(node.properties) &&
    node.properties.every(plainDataProperty)
  );
}
