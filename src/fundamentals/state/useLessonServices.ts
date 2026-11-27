import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from '../../auth/AuthContext';
import type { BrowserStorage } from '../../progress/guest';
import { useProgress } from '../../progress/ProgressProvider';
import { createLessonAssets } from '../delivery/assets';
import { createLessonServices } from './services';

const assets = createLessonAssets();
const storage: BrowserStorage = {
  get length() {
    return localStorage.length;
  },
  key: (offset) => localStorage.key(offset),
  getItem: (key) => localStorage.getItem(key),
  removeItem: (key) => localStorage.removeItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

export function useLessonServices() {
  const [cleanupError, setCleanupError] = useState<unknown>();
  const progress = useProgress();
  const { authStore } = useAccount();
  const store = progress.store;
  const current = useRef(store);
  current.current = store;
  const access = useRef(progress.migrationAccess);
  access.current = progress.migrationAccess;
  const migrationAccess = useCallback(() => access.current(), []);
  const services = useMemo(() => {
    if (!store) return null;
    const owner = store.getSnapshot().owner;
    const member = owner.kind === 'member' ? access.current() : null;
    if (owner.kind === 'member' && !member) throw new Error('Member lesson access is unavailable.');
    return createLessonServices({
      assets,
      storage,
      isCurrent: () => current.current === store && (!member || member.isCurrent()),
      member: member ? { userId: member.owner.userId, client: member.client } : undefined,
    });
  }, [store]);
  useEffect(() => {
    if (!services) return;
    const userId = store?.getSnapshot().owner;
    const unsubscribe = authStore.subscribe(() => {
      const state = authStore.getSnapshot();
      if (
        userId?.kind === 'member' &&
        (state.status === 'unavailable' ||
          (state.status === 'ready' && state.account?.id !== userId.userId))
      ) {
        void services.outbox?.clear().catch((cause: unknown) => setCleanupError(cause));
      }
    });
    return () => {
      unsubscribe();
      services.dispose();
    };
  }, [services, authStore, store]);
  return {
    services,
    status: progress.status,
    owner: store?.getSnapshot().owner,
    cleanupError,
    retry: progress.retry,
    migrationAccess,
  };
}
