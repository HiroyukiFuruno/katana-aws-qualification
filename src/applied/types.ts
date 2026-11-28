export type AppliedSource = { label: string; url: string; language: string };
export type AppliedBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'figure'; id: string };
export type AppliedFigure = { path: string; alt: string; width: number; height: number };
export type AppliedCaseContent = {
  id: string;
  title: string;
  intro: string;
  sections: { id: string; title: string; blocks: (AppliedBlock & { key: string })[] }[];
  referencesTitle: string;
  sources: AppliedSource[];
};

export function appliedFigureIds(content: AppliedCaseContent) {
  return content.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.kind === 'figure' ? [block.id] : [])),
  );
}
