import type { AssessmentItem } from './assessmentTypes';
import type { Skill } from './certificationTypes';
import type source from './content/ja.json';

export type SiteContent = {
  certifications: Record<string, { name: string; focus: string }>;
  guides: Record<
    string,
    { scope: string; difficulty: number; why: string; audience: string; path: string }
  >;
  skills: Record<Skill, string>;
  glossary: typeof source.glossary;
  assessment: AssessmentItem[];
  labels: Record<string, string>;
};
