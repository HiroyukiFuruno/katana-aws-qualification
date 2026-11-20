import type { DashboardContext, DashboardFormat, DashboardMode, DashboardPolarity } from './queryTypes';
import type { DashboardExam, DashboardLessonFinal } from './summaryTypes';

export type DashboardEvent = {
  eventId: string;
  certificationId: string;
  questionId: string;
  questionRevision: number;
  sourceVersion: string;
  category: string;
  mode: DashboardMode;
  context: DashboardContext;
  format: DashboardFormat;
  polarity: DashboardPolarity;
  unitId: string | null;
  contentVersion: string | null;
  answeredAt: string;
  isCorrect: boolean;
  durationMs: number;
  examId: string | null;
  sessionId: string | null;
};

export type DashboardRecords = {
  events: DashboardEvent[];
  exams: Omit<DashboardExam, 'stats' | 'allAnswers'>[];
  lessonFinals: Omit<DashboardLessonFinal, 'stats' | 'allAnswers'>[];
  excludedRecords: number;
};
