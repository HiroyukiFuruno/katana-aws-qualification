import type {
  DashboardContext,
  DashboardFormat,
  DashboardMode,
  DashboardPolarity,
  DashboardQuery,
  DashboardRevision,
} from './queryTypes';
import type {
  DashboardCategoryStats,
  DashboardDailyStats,
  DashboardDuration,
  DashboardNamedStats,
  DashboardRevisionStats,
  DashboardStats,
  DashboardUnitStats,
} from './statTypes';

export type DashboardReview = {
  certificationId: string;
  questionId: string;
  questionRevision: number;
  sourceVersion: string;
  category: string;
  context: DashboardContext;
  unitId: string | null;
  contentVersion: string | null;
  answered: number;
  incorrectCount: number;
  latestAnsweredAt: string;
};

export type DashboardExam = {
  examId: string;
  certificationId: string;
  sourceVersion: string;
  startedAt: string | null;
  submittedAt: string | null;
  lastAnsweredAt: string | null;
  questionCount: number | null;
  stats: DashboardStats;
  allAnswers: DashboardStats;
};

export type DashboardLessonFinal = {
  sessionId: string;
  unitId: string;
  contentVersion: string;
  startedAt: string;
  submittedAt: string;
  score: number;
  requiredScore: number;
  questionCount: number;
  passed: boolean;
  stats: DashboardStats;
  allAnswers: DashboardStats;
};

export type DashboardFacets = {
  certificationIds: string[];
  categories: { certificationId: string; category: string }[];
  modes: DashboardMode[];
  contexts: DashboardContext[];
  formats: DashboardFormat[];
  polarities: DashboardPolarity[];
  revisions: DashboardRevision[];
  units: { unitId: string; contentVersion: string }[];
};

export type DashboardSummary = {
  schemaVersion: 1;
  query: DashboardQuery;
  total: DashboardStats;
  daily: DashboardDailyStats[];
  groups: {
    certifications: DashboardNamedStats[];
    categories: DashboardCategoryStats[];
    modes: DashboardNamedStats[];
    contexts: DashboardNamedStats[];
    formats: DashboardNamedStats[];
    polarities: DashboardNamedStats[];
    revisions: DashboardRevisionStats[];
    units: DashboardUnitStats[];
  };
  duration: DashboardDuration;
  review: DashboardReview[];
  exams: DashboardExam[];
  lessonFinals: DashboardLessonFinal[];
  facets: DashboardFacets;
};
