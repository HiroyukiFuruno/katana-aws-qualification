import type { Locale } from '../locales.ts';
import type { Question } from '../questions.ts';

export type StudyCheckpoint = Pick<Question, 'id' | 'prompt' | 'choices' | 'correct'>;
export type StudySource = { label: string; url: string };
export type StudySection = {
  id: string;
  title: string;
  paragraphs: string[];
  sources: StudySource[];
};
export type StudyPrerequisite = { title: string; slug: string; courseId?: string };
export type StudyUnit = {
  id: string;
  title: string;
  objective: string;
  prerequisites: StudyPrerequisite[];
  sections: StudySection[];
  checkpoints: StudyCheckpoint[];
  glossaryTerms: string[];
};
export type CourseMetadata = {
  title: string;
  description: string;
  examStatus?: string;
  units: Record<string, Pick<StudyUnit, 'title' | 'objective'>>;
};
export type StudyMetadata = Record<Locale, Record<string, CourseMetadata>>;
