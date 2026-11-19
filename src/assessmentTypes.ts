import type { Skill } from './certifications';

export type AssessmentItem = {
  id: string;
  skill: Skill;
  prompt: string;
  options: [string, string, string];
  correct: number;
};
