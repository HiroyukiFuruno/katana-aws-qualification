import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { AuthStore } from './AuthStore';
import { createAccountAuth } from './runtime';

const Context = createContext<AuthStore | null>(null);

function initialize() {
  try {
    return new AuthStore(createAccountAuth());
  } catch {
    return new AuthStore(null, true);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(initialize);
  useEffect(() => store.start(), [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useAccount() {
  const store = useContext(Context);
  if (!store) throw new Error('Missing authentication context');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, service: store.service };
}
