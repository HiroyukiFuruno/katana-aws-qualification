export type DashboardStats = {
  answered: number;
  correct: number;
  accuracy: number | null;
  durationMs: number;
  meanDurationMs: number | null;
};

export type DashboardNamedStats = DashboardStats & { key: string };
export type DashboardDailyStats = DashboardStats & { date: string };
export type DashboardCategoryStats = DashboardStats & {
  certificationId: string;
  category: string;
  sourceVersion: string;
  questionRevision: number;
};
export type DashboardRevisionStats = DashboardStats & {
  sourceVersion: string;
  questionRevision: number;
};
export type DashboardUnitStats = DashboardStats & { unitId: string; contentVersion: string };

export type DashboardDuration = {
  count: number;
  min: number | null;
  p05: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  max: number | null;
  bins: { lowerMs: number; upperMs: number | null; count: number }[];
};
