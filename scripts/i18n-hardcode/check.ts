import { relative } from 'node:path';
import {
  type Ast,
  args,
  ast,
  name,
  nodes,
  type Path,
  property,
  prose,
  type Source,
  walk,
} from './ast.ts';
import { nativeDialog } from './dialogs.ts';
import { displayProp, linkSources } from './link.ts';
import { createTrace } from './trace.ts';

export type Finding = {
  file: string;
  line: number;
  column: number;
  rule: 'hardcoded-ui-text' | 'raw-error-message';
  text: string;
  sink: string;
  sinkFile: string;
  sinkLine: number;
};

export function location(source: Source, node: Ast) {
  const span = node.span as { start: number } | undefined;
  const rootSpan = source.ast.span as { start: number };
  const before = Buffer.from(source.text)
    .subarray(0, Math.max(0, (span?.start ?? rootSpan.start) - rootSpan.start))
    .toString('utf8');
  const lines = before.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function checkSources(sources: Source[], root: string): Finding[] {
  linkSources(sources);
  const trace = createTrace(sources);
  const findings = new Map<string, Finding>();
  const inspect = (source: Source, node: Ast | undefined, sink: string, path: Path = []) => {
    if (!node) return;
    for (const origin of trace(source, node, path)) {
      if (!origin.rawError && !prose(origin.text)) continue;
      const at = location(origin.source, origin.node);
      const finding: Finding = {
        file: relative(root, origin.source.path),
        ...at,
        rule: origin.rawError ? 'raw-error-message' : 'hardcoded-ui-text',
        text: origin.text.trim().replace(/\s+/g, ' '),
        sink,
        sinkFile: relative(root, source.path),
        sinkLine: location(source, node).line,
      };
      findings.set(`${finding.file}:${at.line}:${at.column}:${finding.rule}`, finding);
    }
  };
  for (const source of sources)
    walk(source.ast, (node) => {
      if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
        for (const child of nodes(node.children)) {
          if (['JSXText', 'JSXExpressionContainer'].includes(child.type))
            inspect(source, child, 'JSX child');
        }
      }
      if (node.type === 'JSXAttribute' && displayProp(name(ast(node.name)))) {
        inspect(source, ast(node.value), `JSX ${name(ast(node.name))}`);
      }
      if (node.type === 'JSXAttribute' && name(ast(node.name)) === 'dangerouslySetInnerHTML') {
        inspect(source, ast(node.value), 'JSX HTML content', ['__html']);
      }
      if (node.type === 'JSXOpeningElement') {
        const attributes = nodes(node.attributes);
        const inputType = attributes.find((attribute) => name(ast(attribute.name)) === 'type');
        if (name(ast(node.name)) === 'textarea') {
          for (const field of ['value', 'defaultValue']) {
            const attribute = attributes.find((item) => name(ast(item.name)) === field);
            inspect(source, ast(attribute?.value), `textarea ${field}`);
          }
        }
        if (
          name(ast(node.name)) === 'input' &&
          ['button', 'submit', 'reset'].includes(name(ast(inputType?.value)))
        ) {
          const value = attributes.find((attribute) => name(ast(attribute.name)) === 'value');
          inspect(source, ast(value?.value), 'input button value');
        }
        for (const attribute of nodes(node.attributes)) {
          if (attribute.type !== 'SpreadElement') continue;
          for (const field of [
            'children',
            'label',
            'title',
            'placeholder',
            'alt',
            'aria-label',
            'aria-description',
            'text',
            'message',
          ]) {
            inspect(source, ast(attribute.arguments), `JSX spread ${field}`, [field]);
          }
        }
      }
      if (node.type === 'CallExpression') {
        const callee = ast(node.callee);
        const member = callee?.type === 'MemberExpression' ? property(ast(callee.property)) : '';
        const direct = name(callee);
        if (nativeDialog(callee) || member === 'setCustomValidity') {
          inspect(source, args(node)[0], member || direct);
        }
        if (
          member === 'setAttribute' &&
          ['aria-label', 'aria-description', 'title', 'alt', 'placeholder'].includes(name(args(node)[0]))
        ) {
          inspect(source, args(node)[1], `setAttribute ${name(args(node)[0])}`);
        }
      }
      if (node.type === 'AssignmentExpression') {
        const target = ast(node.left);
        if (
          target?.type === 'MemberExpression' &&
          ['textContent', 'innerText', 'title', 'placeholder'].includes(property(ast(target.property)))
        ) {
          inspect(source, ast(node.right), `DOM ${property(ast(target.property))}`);
        }
      }
    });
  return [...findings.values()].sort(
    (left, right) =>
      left.file.localeCompare(right.file, 'en') || left.line - right.line || left.column - right.column,
  );
}
