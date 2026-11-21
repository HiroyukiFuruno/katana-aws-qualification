import { parseSync } from '@swc/core';

export function translationReferences(source: string, filename: string): string[] {
  const keys = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.type === 'CallExpression') {
      const callee = node.callee as Record<string, unknown>;
      if (callee?.type === 'Identifier' && callee.value === 't') {
        const argument = (node.arguments as { expression: Record<string, unknown> }[])[0];
        if (argument?.expression.type === 'StringLiteral') {
          keys.add(String(argument.expression.value));
        }
      }
    }
    for (const child of Object.values(node)) visit(child);
  }
  visit(parseSync(source, { syntax: 'typescript', tsx: filename.endsWith('.tsx') }));
  return [...keys].sort();
}
