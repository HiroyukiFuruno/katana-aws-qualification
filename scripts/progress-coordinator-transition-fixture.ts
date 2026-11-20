import { mock } from 'bun:test';
import { AuthStore } from '../src/auth/AuthStore';
import type { Account, AccountAuth } from '../src/auth/types';
import type { ProgressCoordinator } from '../src/progress/ProgressCoordinator';

export const configuration = { key: 'public-key', url: 'https://learning.example' };
export const account = (id: string): Account => ({ email: `${id}@example.test`, id, identities: [] });
export function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}
export function authFixture() {
  let current: Account | null = null;
  let listener: (value: Account | null) => void = () => {};
  let rejectAccount = false;
  const unsupported = () => Promise.reject(new Error('Unexpected operation'));
  const service: AccountAuth = {
    completeCallback: unsupported,
    deleteAccount: unsupported,
    getAccessToken: async (id) => {
      if (!current || current.id !== id) throw new Error('Account changed');
      return `${id}-token`;
    },
    getAccount: () =>
      rejectAccount ? Promise.reject(new Error('Account unavailable')) : Promise.resolve(current),
    linkIdentity: unsupported,
    providers: [],
    refresh: unsupported,
    signIn: unsupported,
    signOut: unsupported,
    subscribe(next) {
      listener = next;
      return () => {
        listener = () => {};
      };
    },
    unlinkIdentity: unsupported,
  };
  return {
    authStore: new AuthStore(service),
    emit(value: Account | null) {
      current = value;
      listener(value);
    },
    fail() {
      rejectAccount = true;
      listener(current);
    },
  };
}
export function api() {
  const original = globalThis.fetch;
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url.includes('/rpc/initialize_learning_state')) return Response.json(1);
    return new Response('[]', { headers: { 'Content-Range': '0-0/0' } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
export function waitForOwner(coordinator: ProgressCoordinator, id: string) {
  const matches = () =>
    coordinator.getSnapshot().status === 'ready' &&
    coordinator.getSnapshot().store?.getSnapshot().owner.kind === 'member' &&
    coordinator.getSnapshot().store.getSnapshot().owner.userId === id;
  if (matches()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = coordinator.subscribe(() => {
      if (matches()) {
        unsubscribe();
        resolve();
      }
    });
  });
}
