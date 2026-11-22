import type { DashboardPreferences } from './preferenceTypes';
import { buildDashboardQuery, dashboardQueryKey } from './query';
import type { DashboardQuery } from './queryTypes';
import type { DashboardServices } from './services';
import type { DashboardDataState } from './viewTypes';

export async function loadDashboardWidgets(input: {
  preferences: DashboardPreferences;
  asOf: number;
  summary: DashboardServices['summary'];
  isCurrent: () => boolean;
  publish: (ids: string[], state: DashboardDataState) => void;
  retry: () => void;
}) {
  const groups = new Map<string, { query: DashboardQuery; ids: string[] }>();
  for (const widget of input.preferences.widgets.filter(
    (widget) => widget.visible && widget.kind !== 'milestones',
  )) {
    const query = buildDashboardQuery({ ...input.preferences.filters, ...widget.overrides }, input.asOf);
    const key = dashboardQueryKey(query);
    const group = groups.get(key) ?? { query, ids: [] };
    group.ids.push(widget.id);
    groups.set(key, group);
  }
  const queue = [...groups.values()];
  const worker = async () => {
    while (queue.length && input.isCurrent()) {
      const group = queue.shift();
      if (!group) return;
      try {
        const value = await input.summary(group.query);
        if (input.isCurrent())
          input.publish(group.ids, { status: 'ready', ...value, retry: input.retry });
      } catch {
        if (input.isCurrent()) input.publish(group.ids, { status: 'error', retry: input.retry });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
}
