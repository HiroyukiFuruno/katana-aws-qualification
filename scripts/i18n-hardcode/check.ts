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
import { jsxTextSinks } from './jsx.ts';
import { linkSources } from './link.ts';
import { sinkCallOrigins } from './sink-call-context.ts';
import { isTextualAriaAttribute, isTextualDomProperty, sinkNames } from './sink-metadata.ts';
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
    for (const origin of sinkCallOrigins(sources, source, node, path, trace)) {
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
  const namesFrom = (source: Source, node: Ast | undefined) =>
    sinkNames(trace.bind(undefined, source), node);
  for (const source of sources)
    walk(source.ast, (node) => {
      if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
        for (const child of nodes(node.children)) {
          if (['JSXText', 'JSXExpressionContainer'].includes(child.type))
            inspect(source, child, 'JSX child');
        }
      }
      if (node.type === 'JSXOpeningElement') {
        for (const sink of jsxTextSinks(node, (value, path) => trace(source, value, path)))
          inspect(source, sink.node, sink.name, sink.path);
      }
      if (node.type === 'CallExpression') {
        const callee = ast(node.callee);
        const member = callee?.type === 'MemberExpression' ? property(ast(callee.property)) : '';
        const direct = name(callee);
        if (nativeDialog(callee) || member === 'setCustomValidity') {
          inspect(source, args(node)[0], member || direct);
        }
        if (member === 'setAttribute') {
          for (const attribute of namesFrom(source, args(node)[0])) {
            if (
              isTextualAriaAttribute(attribute) ||
              ['title', 'alt', 'placeholder'].includes(attribute)
            ) {
              inspect(source, args(node)[1], `setAttribute ${attribute}`);
            }
          }
        }
      }
      if (node.type === 'AssignmentExpression') {
        const target = ast(node.left);
        const targetProperty = target?.type === 'MemberExpression' ? ast(target.property) : undefined;
        const properties =
          target?.type === 'MemberExpression' && property(targetProperty) !== '*'
            ? [property(targetProperty)]
            : namesFrom(source, targetProperty);
        if (
          target?.type === 'MemberExpression' &&
          properties.some(
            (targetName) =>
              ['textContent', 'innerText', 'title', 'placeholder'].includes(targetName) ||
              isTextualDomProperty(targetName),
          )
        ) {
          for (const targetName of properties) {
            if (
              ['textContent', 'innerText', 'title', 'placeholder'].includes(targetName) ||
              isTextualDomProperty(targetName)
            ) {
              inspect(source, ast(node.right), `DOM ${targetName}`);
            }
          }
        }
      }
    });
  return [...findings.values()].sort(
    (left, right) =>
      left.file.localeCompare(right.file, 'en') || left.line - right.line || left.column - right.column,
  );
}
