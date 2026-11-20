import { useEffect, useState } from 'react';
import { loadDashboardWidgets } from './loadWidgets';
import { clearDashboardSync, type DashboardSyncStatus } from './pending';
import type { DashboardPreferences } from './preferenceTypes';
import type { DashboardServices } from './services';
import type { DashboardDataState, DashboardViewProps } from './viewTypes';

type State = {
  cycle: object;
  data: Map<string, DashboardDataState>;
  lessons: DashboardViewProps['lessons'];
  syncStatus: DashboardSyncStatus;
};
export function useDashboardData(
  cycle: {
    services: DashboardServices;
    preferences: DashboardPreferences;
    asOf: number;
    enabled: boolean;
  },
  retry: () => void,
) {
  const [state, setState] = useState<State>({
    cycle,
    data: new Map(),
    lessons: { status: 'loading', items: [] },
    syncStatus: clearDashboardSync,
  });
  useEffect(() => {
    let active = true;
    setState({
      cycle,
      data: new Map(),
      lessons: { status: 'loading', items: [] },
      syncStatus: clearDashboardSync,
    });
    if (!cycle.enabled)
      return () => {
        active = false;
      };
    void loadDashboardWidgets({
      preferences: cycle.preferences,
      asOf: cycle.asOf,
      summary: cycle.services.summary,
      isCurrent: () => active,
      retry,
      publish(ids, value) {
        if (!active) return;
        setState((previous) => {
          const data = new Map(previous.cycle === cycle ? previous.data : []);
          for (const id of ids) data.set(id, value);
          return { ...previous, cycle, data };
        });
      },
    })
      .catch(() => {
        if (!active) return;
        setState((previous) => ({
          ...previous,
          data: new Map(
            cycle.preferences.widgets
              .filter((widget) => widget.visible)
              .map((widget) => [widget.id, { status: 'error' as const, retry }]),
          ),
        }));
      })
      .then(() => cycle.services.syncStatus())
      .then((syncStatus) => {
        if (active) setState((previous) => ({ ...previous, syncStatus }));
      })
      .catch(() => {
        if (active)
          setState((previous) => ({ ...previous, syncStatus: { pending: false, unreadable: true } }));
      });
    void cycle.services
      .lessons()
      .then((items) => {
        if (active) setState((previous) => ({ ...previous, lessons: { status: 'ready', items } }));
      })
      .catch(() => {
        if (active) setState((previous) => ({ ...previous, lessons: { status: 'error', items: [] } }));
      });
    return () => {
      active = false;
    };
  }, [cycle, retry]);
  return state.cycle === cycle
    ? state
    : {
        cycle,
        data: new Map<string, DashboardDataState>(),
        lessons: { status: 'loading' as const, items: [] },
        syncStatus: clearDashboardSync,
      };
}
