import type { Question } from '../questions';

export type FundamentalsQuestion = Question & {
  unitId: string;
  selectionPolarity: 'correct' | 'incorrect';
  requiredChoices: number;
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
