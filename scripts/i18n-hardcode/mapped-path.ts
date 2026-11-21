import type { Path } from './ast.ts';

export function mappedPaths(path: Path, flatten: boolean): Path[] {
  let selection = path;
  while (typeof selection[0] === 'object' && selection[0].kind === 'array-rest')
    selection = selection.slice(1);
  if (selection.length && selection[0] !== '*' && !/^\d+$/.test(String(selection[0]))) return [];
  const selected = selection.length ? selection.slice(1) : selection;
  return flatten ? [selected, [{ kind: 'array-rest', start: 0 }, '*', ...selected]] : [selected];
}
