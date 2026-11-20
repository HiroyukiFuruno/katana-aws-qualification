import type { Question } from '../questions';

export type FundamentalsQuestion = Question & {
  unitId: string;
  selectionPolarity: 'correct' | 'incorrect';
  requiredChoices: number;
  objectiveId?: string;
  sectionId?: string;
  application?: 'recall' | 'apply' | 'integrate';
};

export type FundamentalsSection = {
  id: string;
  title: string;
  paragraphs: string[];
  example: { scenario: string; steps: string[]; outcome: string };
  misconception: { claim: string; correction: string };
  takeaways: string[];
  source: { label: string; url: string };
};

export type FundamentalsUnit = {
  id: string;
  order: number;
  title: string;
  summary: string;
  prerequisites: string[];
  objective: string;
  explanation: string[];
  example: string;
  learningObjectives?: { id: string; text: string; sectionIds: string[] }[];
  sections?: FundamentalsSection[];
  next?: string;
  questions: FundamentalsQuestion[];
};

export type FundamentalsCatalogItem = {
  id: string;
  order: number;
  parent: string;
  prerequisiteIds: string[];
  state: 'published' | 'planned';
  title: string;
  objective: string;
};

export type FundamentalsContent = {
  catalog: FundamentalsCatalogItem[];
  units: FundamentalsUnit[];
};
