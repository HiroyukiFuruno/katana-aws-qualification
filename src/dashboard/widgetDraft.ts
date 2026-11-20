import { readDashboardPreferences } from './preferenceCodec';
import type { DashboardPreferences } from './preferenceTypes';

export function applyDashboardWidgetDraft<T extends { preferences: DashboardPreferences; asOf: number }>(
  current: T | null,
  draft: DashboardPreferences,
): T | null {
  if (!current || JSON.stringify(current.preferences.widgets) === JSON.stringify(draft.widgets))
    return current;
  try {
    const preferences = readDashboardPreferences({ ...draft, filters: current.preferences.filters });
    return { ...current, preferences, asOf: Date.now() };
  } catch {
    // 入力途中の不正な条件は適用せず、編集内容を残して明示適用時に検証する。
    return current;
  }
}
