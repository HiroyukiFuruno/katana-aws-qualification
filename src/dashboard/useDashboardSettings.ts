import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressApiError } from '../progress/api';
import { DashboardSettingsConflict } from './guestSettings';
import { readDashboardPreferences } from './preferenceCodec';
import { dashboardDefaults } from './preferences';
import type { DashboardPreferences } from './preferenceTypes';
import type { DashboardServices } from './services';
import { useExternalDashboardSettings } from './useExternalSettings';
import type { DashboardViewProps } from './viewTypes';

type SettingsState = {
  status: 'loading' | 'ready' | 'error';
  draft: DashboardPreferences;
  saved: DashboardPreferences | null;
  revision: number;
  saving: boolean;
  saveState: DashboardViewProps['saveState'];
};

export function useDashboardSettings(
  services: DashboardServices,
  timezone: string,
  onApplied: (preferences: DashboardPreferences) => void,
  guest: boolean,
) {
  const [state, setState] = useState<SettingsState>(() => ({
    status: 'loading',
    draft: dashboardDefaults(timezone),
    saved: null,
    revision: 0,
    saving: false,
    saveState: 'idle',
  }));
  const latest = useRef({ services, timezone, onApplied, state });
  latest.current = { services, timezone, onApplied, state };
  const active = useRef(false);
  const operation = useRef(0);
  const busy = useRef(false);
  const reload = useCallback(() => {
    const id = ++operation.current;
    busy.current = false;
    setState((previous) => ({ ...previous, status: 'loading', saving: false }));
    void latest.current.services
      .settings()
      .then((saved) => {
        if (!active.current || id !== operation.current) return;
        const preferences = saved.settings ?? dashboardDefaults(latest.current.timezone);
        setState({
          status: 'ready',
          draft: preferences,
          saved: saved.invalid ? null : preferences,
          revision: saved.revision,
          saving: false,
          saveState: saved.invalid ? 'invalid-stored' : 'idle',
        });
        latest.current.onApplied(preferences);
      })
      .catch(() => {
        if (active.current && id === operation.current)
          setState((previous) => ({ ...previous, status: 'error' }));
      });
  }, []);
  useEffect(() => {
    active.current = true;
    reload();
    return () => {
      active.current = false;
      operation.current++;
    };
  }, [reload]);
  useExternalDashboardSettings(guest, () => {
    const current = latest.current.state;
    if (current.saving || JSON.stringify(current.draft) !== JSON.stringify(current.saved))
      setState((previous) => ({ ...previous, saveState: 'conflict' }));
    else reload();
  });
  const apply = () => {
    try {
      const preferences = readDashboardPreferences(latest.current.state.draft);
      setState((previous) => ({ ...previous, draft: preferences }));
      latest.current.onApplied(preferences);
    } catch {
      setState((previous) => ({ ...previous, saveState: 'error' }));
    }
  };
  const save = () => {
    if (busy.current || latest.current.state.status !== 'ready') return;
    let payload: DashboardPreferences;
    try {
      payload = readDashboardPreferences(latest.current.state.draft);
    } catch {
      setState((previous) => ({ ...previous, saveState: 'error' }));
      return;
    }
    busy.current = true;
    const id = ++operation.current;
    setState((previous) => ({ ...previous, draft: payload, saving: true }));
    void latest.current.services
      .save(payload, latest.current.state.revision)
      .then((saved) => {
        if (!active.current || id !== operation.current) return;
        setState((previous) => ({
          ...previous,
          saved: saved.settings,
          revision: saved.revision,
          saving: false,
          saveState: 'saved',
        }));
      })
      .catch((error: unknown) => {
        if (!active.current || id !== operation.current) return;
        const conflict =
          error instanceof DashboardSettingsConflict ||
          (error instanceof ProgressApiError && error.code === 'PT412');
        setState((previous) => ({
          ...previous,
          saving: false,
          saveState: conflict ? 'conflict' : 'error',
        }));
      })
      .finally(() => {
        if (id === operation.current) busy.current = false;
      });
  };
  return {
    ...state,
    dirty: JSON.stringify(state.draft) !== JSON.stringify(state.saved),
    apply,
    save,
    reload,
    change: (draft: DashboardPreferences) => setState((previous) => ({ ...previous, draft })),
    reset() {
      const draft = dashboardDefaults(latest.current.timezone);
      setState((previous) => ({ ...previous, draft }));
      latest.current.onApplied(draft);
    },
  };
}
