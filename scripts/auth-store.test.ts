import { expect, test } from 'bun:test';
import { AuthStore } from '../src/auth/AuthStore';
import type { Account, AccountAuth } from '../src/auth/types';

const account: Account = { id: 'first-user', email: 'first@example.test', identities: [] };

function fixture() {
  let resolveAccount: (account: Account | null) => void = () => {};
  let listener: (account: Account | null) => void = () => {};
  let unsubscribed = false;
  const pending = new Promise<Account | null>((resolve) => {
    resolveAccount = resolve;
  });
  const unsupported = async () => {
    throw new Error('Unexpected operation');
  };
  const service: AccountAuth = {
    providers: [],
    getAccount: () => pending,
    getAccessToken: unsupported,
    subscribe(next) {
      listener = next;
      return () => {
        unsubscribed = true;
      };
    },
    signIn: unsupported,
    completeCallback: unsupported,
    refresh: unsupported,
    signOut: unsupported,
    deleteAccount: unsupported,
    linkIdentity: unsupported,
    unlinkIdentity: unsupported,
  };
  return {
    service,
    resolve: (value: Account | null) => resolveAccount(value),
    emit: (value: Account | null) => listener(value),
    stopped: () => unsubscribed,
  };
}

test('an unconfigured deployment stays available for guest study', () => {
  const store = new AuthStore(null);
  expect(store.getSnapshot()).toEqual({ status: 'unavailable', account: null });
  store.start()();
});

test('account state is published only after server verification', async () => {
  const source = fixture();
  const store = new AuthStore(source.service);
  const stop = store.start();
  source.emit(account);
  expect(store.getSnapshot()).toEqual({ status: 'loading', account: null });
  source.resolve(account);
  await Bun.sleep(0);
  expect(store.getSnapshot()).toEqual({ status: 'ready', account });
  stop();
  expect(source.stopped()).toBe(true);
});

test('late account verification cannot restore a signed-out user', async () => {
  const source = fixture();
  const store = new AuthStore(source.service);
  const stop = store.start();
  source.emit(null);
  source.resolve(account);
  await Bun.sleep(0);
  expect(store.getSnapshot()).toEqual({ status: 'ready', account: null });
  stop();
});

test('disposed stores do not publish a stale verification result', async () => {
  const source = fixture();
  const store = new AuthStore(source.service);
  const stop = store.start();
  stop();
  source.resolve(account);
  await Bun.sleep(0);
  expect(store.getSnapshot().account).toBeNull();
});

test('verification failure publishes an error state and notifies subscribers', async () => {
  const source = fixture();
  const failed = Promise.reject(new Error('verification failed'));
  source.service.getAccount = () => failed;
  const store = new AuthStore(source.service);
  let notifications = 0;
  store.subscribe(() => {
    notifications += 1;
  });
  const stop = store.start();
  await failed.catch(() => {});
  await Bun.sleep(0);
  expect(store.getSnapshot()).toEqual({ status: 'error', account: null });
  expect(notifications).toBeGreaterThanOrEqual(2);
  stop();
});

test('an unsubscribe prevents later auth events from changing the snapshot', async () => {
  const source = fixture();
  const store = new AuthStore(source.service);
  const stop = store.start();
  source.emit(account);
  stop();
  source.resolve(account);
  await Bun.sleep(0);
  expect(store.getSnapshot()).toEqual({ status: 'loading', account: null });
});
