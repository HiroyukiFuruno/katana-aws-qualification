export type AppliedSource = { label: string; url: string; language: string };
export type AppliedBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] };
export type AppliedCaseContent = {
  id: string;
  title: string;
  intro: string;
  sections: { id: string; title: string; blocks: (AppliedBlock & { key: string })[] }[];
  referencesTitle: string;
  sources: AppliedSource[];
};
