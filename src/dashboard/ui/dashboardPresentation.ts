import type { Message } from '../../messages';
import type { DashboardWidgetKind } from '../preferenceTypes';

export const dashboardDensityKeys = {
  compact: 'dashboardDensityCompact',
  standard: 'dashboardDensityStandard',
  full: 'dashboardDensityFull',
} as const satisfies Record<string, Message>;

export type DashboardDensity = keyof typeof dashboardDensityKeys;

export const dashboardSections: readonly {
  id: string;
  label: Message;
  kinds: readonly DashboardWidgetKind[];
}[] = [
  { id: 'activity', label: 'dashboardSectionActivity', kinds: ['trend', 'overview', 'calendar'] },
  {
    id: 'breakdown',
    label: 'dashboardSectionBreakdown',
    kinds: ['certifications', 'categories', 'modes', 'contexts', 'formats', 'revisions'],
  },
  { id: 'timing', label: 'dashboardSectionTime', kinds: ['durations', 'relationship'] },
  { id: 'results', label: 'dashboardSectionResults', kinds: ['exams', 'reviews'] },
  { id: 'lessons', label: 'dashboardSectionLessons', kinds: ['lessons'] },
];

export const dashboardDensityStorageKey = 'katana-dashboard-density';

export function readDashboardDensity(): DashboardDensity {
  try {
    const saved = localStorage.getItem(dashboardDensityStorageKey);
    if (saved === 'compact' || saved === 'full') return saved;
  } catch {
    // 端末の保存を利用できない場合は標準表示で開始する。
  }
  return 'standard';
}

export function saveDashboardDensity(density: DashboardDensity) {
  try {
    localStorage.setItem(dashboardDensityStorageKey, density);
  } catch {
    // この画面での切り替えは引き続き有効にする。
  }
}
