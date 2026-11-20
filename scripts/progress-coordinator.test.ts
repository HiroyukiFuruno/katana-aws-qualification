import { expect, mock, test } from 'bun:test';
import { getActiveProgressStore } from '../src/history';
import { ProgressCoordinator } from '../src/progress/ProgressCoordinator';
import { account, authFixture, configuration, storage } from './progress-coordinator-transition-fixture';
import { waitForGuest, waitForStatus } from './progress-test-helpers';

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
    await waitForGuest(coordinator);
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
    await waitForGuest(coordinator);
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
