import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAccount } from '../auth/AuthContext';
import { authConfiguration } from '../auth/config';
import type { BrowserStorage } from './guest';
import { createProgressApi } from './api';
import type { LegacyMigrationInput } from './migration';
import { ProgressCoordinator } from './ProgressCoordinator';
import { sameProgressOwner } from './types';
import './progress.css';

const Context = createContext<ProgressCoordinator | null>(null);
const storage: BrowserStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { authStore } = useAccount();
  const [coordinator] = useState(
    () =>
      new ProgressCoordinator(
        authStore,
        authStore.service
          ? authConfiguration({
              url: import.meta.env.VITE_SUPABASE_URL,
              key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            })
          : null,
        storage,
      ),
  );
  useEffect(() => coordinator.start(), [coordinator]);
  return <Context.Provider value={coordinator}>{children}</Context.Provider>;
}

export function useProgress() {
  const coordinator = useContext(Context);
  if (!coordinator) throw new Error('Missing learning records context');
  const activeCoordinator = coordinator;
  const { authStore, service } = useAccount();
  const snapshot = useSyncExternalStore(activeCoordinator.subscribe, activeCoordinator.getSnapshot);
  function migrationAccess(): Omit<LegacyMigrationInput, 'resolveQuestion' | 'storage'> | null {
    const store = snapshot.store;
    const owner = store?.getSnapshot().owner;
    const configuration =
      service &&
      authConfiguration({
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      });
    if (!store || owner?.kind !== 'member' || !service || !configuration) return null;
    return {
      owner,
      client: createProgressApi(
        configuration,
        () => service.getAccessToken(owner.userId),
        () => {
          const current = activeCoordinator.getSnapshot().store;
          return current === store && sameProgressOwner(current.getSnapshot().owner, owner);
        },
      ),
      isCurrent: () => {
        const current = activeCoordinator.getSnapshot().store;
        return (
          current === store &&
          sameProgressOwner(current.getSnapshot().owner, owner) &&
          authStore.getSnapshot().account?.id === owner.userId
        );
      },
    };
  }
  return { ...snapshot, migrationAccess, retry: () => void activeCoordinator.retry() };
}
