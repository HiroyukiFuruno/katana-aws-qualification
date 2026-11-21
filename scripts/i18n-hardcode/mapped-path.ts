import type { Path } from './ast.ts';

function selected(path: Path, strict = false): Path | undefined {
  let selection = path;
  while (
    typeof selection[0] === 'object' &&
    ['array-filter', 'array-range', 'array-rest'].includes(selection[0].kind)
  )
    selection = selection.slice(1);
  if (!selection.length) return selection;
  if (selection[0] === '*' || /^\d+$/.test(String(selection[0]))) return selection.slice(1);
  return strict ? undefined : selection;
}

export function mappedPaths(path: Path, flatten: boolean): Path[] {
  let output = selected(path, true);
  if (!output) return [];
  while (typeof output[0] === 'object') {
    const next = selected(output);
    if (!next) break;
    output = next;
  }
  return flatten ? [output, [{ kind: 'array-rest', start: 0 }, '*', ...output]] : [output];
}
