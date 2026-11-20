export type DashboardPeriod = '7d' | '30d' | '90d' | 'all';
export type DashboardMode = 'study' | 'review' | 'exam';
export type DashboardContext = 'practice' | 'exam' | 'lesson-checkpoint' | 'lesson-final';
export type DashboardFormat = 'choice-single' | 'choice-multiple' | 'ordering' | 'matching' | 'unknown';
export type DashboardPolarity = 'correct' | 'incorrect' | 'unspecified';
export type DashboardRevision = { sourceVersion: string; questionRevision: number };

export type DashboardDimensions = {
  certificationIds: string[] | null;
  categories: string[] | null;
  modes: DashboardMode[] | null;
  contexts: DashboardContext[] | null;
  formats: DashboardFormat[] | null;
  polarities: DashboardPolarity[] | null;
  revisions: DashboardRevision[] | null;
  unitIds: string[] | null;
};

export type DashboardFilters = DashboardDimensions & {
  period: DashboardPeriod;
  timezone: string;
};

export type DashboardQuery = DashboardDimensions & {
  range: { from: string | null; to: string; timezone: string };
};
