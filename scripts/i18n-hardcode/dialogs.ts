import { type Ast, ast, name, property } from './ast.ts';

export function nativeDialog(callee: Ast | undefined): boolean {
  const dialogs = ['alert', 'confirm', 'prompt'];
  if (callee?.type === 'Identifier') return dialogs.includes(name(callee)) && callee.ctxt === 1;
  if (callee?.type !== 'MemberExpression' || !dialogs.includes(property(ast(callee.property))))
    return false;
  const receiver = ast(callee.object);
  // SWCの未解決文脈だけを標準グローバルとし、同名のローカル変数を除外する。
  return (
    receiver?.type === 'Identifier' &&
    receiver.ctxt === 1 &&
    ['window', 'globalThis'].includes(name(receiver))
  );
}
