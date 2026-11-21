import type { Locale } from './locales';
import type { Message } from './messages';

export const skills = {
  fundamentals: 'skillFundamentals',
  architecture: 'skillArchitecture',
  security: 'skillSecurity',
  networking: 'skillNetworking',
  development: 'skillDevelopment',
  operations: 'skillOperations',
  data: 'skillData',
  ai: 'skillAi',
} as const satisfies Record<string, Message>;

export type Skill = keyof typeof skills;

export type ExamBlueprint = {
  minutes: number;
  distribution: Record<string, number>;
};

export type Course = {
  practice: { path: string; label: Message; fixedCount?: number }[];
  mock: string;
  archives: string[];
  exam: ExamBlueprint;
  setSize?: number;
  fixedExamFromBlueprint?: boolean;
  reviewedMock?: true;
  examStorageId?: string;
  studyLocale?: Locale;
  questionTranslations?: string;
};

export type Certification = {
  id: string;
  name: string;
  level: '基礎' | 'アソシエイト' | 'プロフェッショナル' | '専門' | 'ビジネス';
  skills: Skill[];
  focus: Message;
  buildsOn?: string[];
  retireOn?: string;
  beta?: boolean;
  course?: Course;
};

export const levelMessage = {
  基礎: 'foundational',
  アソシエイト: 'associate',
  プロフェッショナル: 'professional',
  専門: 'specialty',
  ビジネス: 'business',
} as const;
