export const inputs: unknown[][] = [[0, 'First copy', false, 'Second copy'], [], ['Single copy']];
export const operations = [
  { source: 'filter(Boolean)', apply: (rows: unknown[]) => rows.filter(Boolean) },
  { source: 'slice(0,0)', apply: (rows: unknown[]) => rows.slice(0, 0) },
  { source: 'slice(1,2)', apply: (rows: unknown[]) => rows.slice(1, 2) },
  { source: 'slice(1)', apply: (rows: unknown[]) => rows.slice(1) },
  { source: 'map((value)=>value)', apply: (rows: unknown[]) => rows.map((value) => value) },
  { source: "map(()=>'Constant copy')", apply: (rows: unknown[]) => rows.map(() => 'Constant copy') },
] as const;
export const selections = ['', ".join('')", '[0]', '[1]'] as const;
export const copyLiterals = ['First copy', 'Second copy', 'Single copy', 'Constant copy'];

export type Operation = (typeof operations)[number];

export function expression(first: Operation, second: Operation, selection: string) {
  return `rows.${first.source}.${second.source}${selection}`;
}

export function apply(first: Operation, second: Operation, rows: unknown[]) {
  return second.apply(first.apply(rows));
}
