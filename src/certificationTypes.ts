import type { Locale } from './locales';
import type { Message } from './messages';

export const skills = {
  fundamentals: 'AWS基礎・コスト',
  architecture: 'アーキテクチャ',
  security: 'セキュリティ',
  networking: 'ネットワーク',
  development: 'アプリケーション開発',
  operations: '運用・DevOps',
  data: 'データエンジニアリング',
  ai: 'AI・機械学習',
} as const;

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
};

export type Certification = {
  id: string;
  name: string;
  level: '基礎' | 'アソシエイト' | 'プロフェッショナル' | '専門' | 'ビジネス';
  skills: Skill[];
  focus: string;
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
