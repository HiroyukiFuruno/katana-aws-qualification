export type ObjectRow = { caption: string | number };
export type Primitive = string | number;
export type Operation = (source: string) => string;
export type AppliedOperation<T> = { source: Operation; apply: (rows: T[]) => T[] };

export const objectInputs: ObjectRow[][] = [
  [{ caption: 'Diagnostic copy' }, { caption: 'Visible copy' }],
  [{ caption: 0 }, { caption: 'Visible copy' }],
  [],
];
export const operationsFor = <T>(): AppliedOperation<T>[] => [
  { source: (value) => `${value}.filter(Boolean)`, apply: (rows) => rows.filter(Boolean) },
  { source: (value) => `${value}.map((row)=>row)`, apply: (rows) => rows.map((row) => row) },
  { source: (value) => `${value}.slice(0,0)`, apply: (rows) => rows.slice(0, 0) },
  { source: (value) => `${value}.slice(1,2)`, apply: (rows) => rows.slice(1, 2) },
  { source: (value) => `${value}.slice(1)`, apply: (rows) => rows.slice(1) },
];
export const selectionsA = ['[0]?.caption', '[1]?.caption', '.map((row)=>row.caption)'] as const;
export const selectionsB = ['direct', ".join('')", '[0]', '[1]'] as const;
export const copyLiterals = ['Diagnostic copy', 'Visible copy'];
