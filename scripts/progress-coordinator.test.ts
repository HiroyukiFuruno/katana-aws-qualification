import { expect, mock, test } from 'bun:test';
import { AuthStore } from '../src/auth/AuthStore';
import type { Account, AccountAuth } from '../src/auth/types';
import { getActiveProgressStore } from '../src/history';
import { ProgressCoordinator } from '../src/progress/ProgressCoordinator';

const configuration = { key: 'public-key', url: 'https://learning.example' };
const account = (id: string): Account => ({ email: `${id}@example.test`, id, identities: [] });
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}
function authFixture() {
  let current: Account | null = null;
  let listener: (value: Account | null) => void = () => {};
  let rejectAccount = false;
  const unsupported = () => Promise.reject(new Error('Unexpected operation'));
  const service: AccountAuth = {
    completeCallback: unsupported,
    deleteAccount: unsupported,
    getAccessToken: async (expectedAccountId) => {
      if (!current || current.id !== expectedAccountId) throw new Error('Account changed');
      return `${expectedAccountId}-token`;
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
function waitForStatus(coordinator: ProgressCoordinator, status: 'error' | 'ready') {
  if (coordinator.getSnapshot().status === status) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = coordinator.subscribe(() => {
      if (coordinator.getSnapshot().status === status) {
        unsubscribe();
        resolve();
      }
    });
  });
}
function installProgressApi() {
  const original = globalThis.fetch;
  const requests: Request[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    if (request.url.includes('/rpc/initialize_learning_state')) return Response.json(1);
    return new Response('[]', { headers: { 'Content-Range': '0-0/0' } });
  }) as typeof fetch;
  return {
    requests,
    restore() {
      globalThis.fetch = original;
    },
  };
}
test('keeps a store for same-owner revalidation and replaces it only for a new owner', async () => {
  const api = installProgressApi();
  const source = authFixture();
  const stopAuth = source.authStore.start();
  const coordinator = new ProgressCoordinator(source.authStore, configuration, storage());
  const stop = coordinator.start();
  try {
    await waitForStatus(coordinator, 'ready');
    source.emit(account('member-a'));
    expect(coordinator.getSnapshot()).toEqual({ status: 'loading', store: null });
    expect(getActiveProgressStore()).toBeNull();
    await waitForStatus(coordinator, 'ready');
    const member = coordinator.getSnapshot().store;
    expect(getActiveProgressStore()).toBe(member);
    expect(member?.getSnapshot().owner).toEqual({ generation: 1, kind: 'member', userId: 'member-a' });
    const rpcBodies = await Promise.all(
      api.requests.filter((request) => request.url.includes('/rpc/')).map((request) => request.text()),
    );
    expect(rpcBodies.join()).not.toContain('member-a');
    expect(rpcBodies.join()).not.toContain('user_id');
    const hasMemberToken = api.requests.some(
      (request) => request.headers.get('Authorization') === 'Bearer member-a-token',
    );
    expect(hasMemberToken).toBe(true);
    source.emit(account('member-a'));
    expect(coordinator.getSnapshot()).toEqual({ status: 'loading', store: null });
    await waitForStatus(coordinator, 'ready');
    expect(coordinator.getSnapshot().store).toBe(member);
    source.emit(account('member-b'));
    await waitForStatus(coordinator, 'ready');
    expect(coordinator.getSnapshot().store?.getSnapshot().owner).toEqual({
      generation: 2,
      kind: 'member',
      userId: 'member-b',
    });
    source.emit(null);
    expect(coordinator.getSnapshot().store?.getSnapshot().owner).toEqual({
      generation: 3,
      kind: 'guest',
    });
  } finally {
    stop();
    stopAuth();
    api.restore();
  }
});
test('does not fall back to guest or authorize stale work after an authentication error', async () => {
  const api = installProgressApi();
  const source = authFixture();
  const stopAuth = source.authStore.start();
  const coordinator = new ProgressCoordinator(source.authStore, configuration, storage());
  const stop = coordinator.start();
  try {
    source.emit(account('member-a'));
    await waitForStatus(coordinator, 'ready');
    const member = coordinator.getSnapshot().store;
    const requestsBeforeFailure = api.requests.length;
    source.fail();
    await waitForStatus(coordinator, 'error');
    expect(coordinator.getSnapshot()).toEqual({ status: 'error', store: null });
    await expect(member?.reset()).rejects.toThrow('owner changed');
    expect(api.requests).toHaveLength(requestsBeforeFailure);
  } finally {
    stop();
    stopAuth();
    api.restore();
  }
});
