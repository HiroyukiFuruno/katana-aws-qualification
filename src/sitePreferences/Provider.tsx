import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useAccount } from '../auth/AuthContext';
import { authConfiguration } from '../auth/config';
import { createProgressApi, ProgressApiError } from '../progress/api';
import { SitePreferenceContext, type SitePreferenceNotice } from './context';
import {
  createSitePreferencesRepository,
  defaultSitePreferences,
  type SitePreferences,
  type SitePreferencesSnapshot,
} from './repository';

type Model = {
  owner: string;
  values: SitePreferences;
  loading: boolean;
  saving: boolean;
  notice: SitePreferenceNotice;
};

export function SitePreferencesProvider({ children }: { children: ReactNode }) {
  const { state, service, authStore } = useAccount();
  const owner = state.status === 'ready' ? state.account?.id : undefined;
  const [model, setModel] = useState<Model | null>(null);
  const [reload, setReload] = useState(0);
  const latestReload = useRef(reload);
  latestReload.current = reload;
  const action = useRef<{ owner: string; save(values: SitePreferences): void } | null>(null);
  useEffect(() => {
    if (!owner || !service) return;
    let active = true;
    let busy = false;
    let previous: SitePreferencesSnapshot | undefined;
    const current = () => {
      const auth = authStore.getSnapshot();
      return (
        active &&
        latestReload.current === reload &&
        auth.status === 'ready' &&
        auth.account?.id === owner
      );
    };
    const publish = (
      values: SitePreferences,
      loading: boolean,
      saving: boolean,
      notice: SitePreferenceNotice,
    ) => {
      if (current()) setModel({ owner, values, loading, saving, notice });
    };
    publish(defaultSitePreferences, true, false, 'idle');
    const configuration = authConfiguration({
      url: import.meta.env.VITE_SUPABASE_URL,
      key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
    if (!configuration) {
      publish(defaultSitePreferences, false, false, 'load-error');
      return () => {
        active = false;
      };
    }
    const repository = createSitePreferencesRepository(
      createProgressApi(configuration, () => service.getAccessToken(owner), current),
    );
    void repository.load().then(
      (saved) => {
        if (!current()) return;
        previous = saved;
        publish(saved, false, false, 'idle');
      },
      () => publish(defaultSitePreferences, false, false, 'load-error'),
    );
    const handler = {
      owner,
      save(values: SitePreferences) {
        if (!current() || busy || !previous) return;
        busy = true;
        publish(values, false, true, 'saving');
        void repository.save(values, previous).then(
          (saved) => {
            if (!current()) return;
            previous = saved;
            busy = false;
            publish(saved, false, false, 'saved');
          },
          (error: unknown) => {
            if (!current()) return;
            // 結果不明や競合の後は、明示的な再読込まで古い改訂で上書きしない。
            const conflict =
              error instanceof ProgressApiError && ['PT409', 'PT412'].includes(error.code ?? '');
            publish(values, false, false, conflict ? 'conflict' : 'save-error');
          },
        );
      },
    };
    action.current = handler;
    return () => {
      active = false;
      if (action.current === handler) action.current = null;
    };
  }, [owner, service, authStore, reload]);

  const kind = owner
    ? 'member'
    : !service || state.status === 'unavailable' || state.status === 'ready'
      ? 'guest'
      : 'pending';
  const visible = model?.owner === owner ? model : null;
  const loading = kind === 'pending' || (kind === 'member' && (!visible || visible.loading));
  return (
    <SitePreferenceContext.Provider
      value={{
        kind,
        values: kind === 'member' ? (visible?.values ?? defaultSitePreferences) : defaultSitePreferences,
        disabled:
          loading ||
          (kind === 'member' &&
            (!!visible?.saving ||
              ['load-error', 'save-error', 'conflict'].includes(visible?.notice ?? ''))),
        loading,
        notice: kind === 'member' ? (visible?.notice ?? 'idle') : 'idle',
        reload() {
          if (owner) {
            setModel({
              owner,
              values: defaultSitePreferences,
              loading: true,
              saving: false,
              notice: 'idle',
            });
            setReload((value) => value + 1);
          }
        },
        save(values) {
          const handler = action.current;
          if (handler && handler.owner === owner) handler.save(values);
        },
      }}
    >
      {children}
    </SitePreferenceContext.Provider>
  );
}
