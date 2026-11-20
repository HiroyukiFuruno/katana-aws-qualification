import type { AuthStore } from '../auth/AuthStore';
import { setActiveProgressStore } from '../history';
import { createMemberClient } from './memberClient';
import type { ProgressConfiguration, ProgressCoordinatorSnapshot } from './coordinatorTypes';
import type { BrowserStorage } from './guest';
import { createProgressStore } from './store';
import type { ProgressStore } from './storeTypes';
import { matchesAuthOwner, type ProgressOwner, sameProgressOwner } from './types';
export type { ProgressCoordinatorSnapshot } from './coordinatorTypes';
export class ProgressCoordinator {
  private active = false;
  private generation = 0;
  private transitionId = 0;
  private owner: ProgressOwner | null = null;
  private store: ProgressStore | null = null;
  private readonly listeners = new Set<() => void>();
  private snapshot: ProgressCoordinatorSnapshot = { status: 'loading', store: null };
  private unsubscribeAuth: (() => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;
  constructor(
    private readonly authStore: AuthStore,
    private readonly configuration: ProgressConfiguration | null,
    private readonly storage: BrowserStorage,
  ) {
    setActiveProgressStore(null);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  start() {
    if (this.active) return () => this.stop();
    this.active = true;
    this.unsubscribeAuth = this.authStore.subscribe(() => this.synchronize());
    this.synchronize();
    return () => this.stop();
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    this.transitionId++;
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    void this.disposeStore(false).catch(() => {
      if (this.active) this.publish({ status: 'error', store: null });
    });
    this.publish({ status: 'loading', store: null });
  }
  async retry() {
    const store = this.store;
    if (!store) return;
    try {
      await store.retryPending();
    } catch {
      if (this.store === store) this.publishStore(store);
    }
  }
  private publish(snapshot: ProgressCoordinatorSnapshot) {
    this.snapshot = snapshot;
    setActiveProgressStore(snapshot.store ?? null);
    for (const listener of this.listeners) listener();
  }
  private publishStore(store: ProgressStore) {
    const snapshot = store.getSnapshot();
    this.publish(
      snapshot.state === 'ready' ? { status: 'ready', store } : { status: snapshot.state, store: null },
    );
  }
  private synchronize() {
    const auth = this.authStore.getSnapshot();
    if (auth.status === 'loading') {
      this.transitionId++;
      this.publish({ status: 'loading', store: null });
      return;
    }
    if (auth.status === 'error') {
      this.transitionId++;
      this.publish({ status: 'error', store: null });
      return;
    }
    const owner = this.ownerFor(auth.status === 'ready' ? auth.account?.id : undefined);
    if (!owner) {
      this.publish({ status: 'error', store: null });
      return;
    }
    if (this.store && this.owner && sameProgressOwner(this.owner, owner)) {
      this.publishStore(this.store);
      if (this.store.getSnapshot().state === 'error') void this.store.initialize();
      return;
    }
    const transitionId = ++this.transitionId;
    void this.replaceStore(owner, transitionId).catch(() => {
      if (this.active && this.transitionId === transitionId)
        this.publish({ status: 'error', store: null });
    });
  }
  private ownerFor(userId?: string): ProgressOwner | null {
    if (!userId) return { generation: this.generation, kind: 'guest' };
    if (!this.authStore.service || !this.configuration) return null;
    return { generation: this.generation, kind: 'member', userId };
  }
  private async replaceStore(nextOwner: ProgressOwner, transitionId: number) {
    if (this.owner) this.generation++;
    const owner = this.ownerFor(nextOwner.kind === 'member' ? nextOwner.userId : undefined);
    if (!owner) throw new Error('Member progress requires authentication.');
    await this.disposeStore(true);
    if (
      !this.active ||
      this.transitionId !== transitionId ||
      !matchesAuthOwner(this.authStore.getSnapshot(), owner)
    )
      return;
    let store: ProgressStore | null = null;
    const client =
      owner.kind === 'member'
        ? createMemberClient(this.authStore, this.configuration, owner, () =>
            this.isCurrent(owner, store),
          )
        : undefined;
    store = createProgressStore({
      client,
      isCurrent: () => this.isCurrent(owner, store),
      onStaleGeneration: () => void store?.initialize(),
      owner,
      storage: this.storage,
    });
    this.owner = owner;
    this.store = store;
    this.unsubscribeStore = store.subscribe(() => {
      if (this.isCurrent(owner, store)) this.publishStore(store);
    });
    this.publishStore(store);
    void store.initialize();
  }
  private isCurrent = (owner: ProgressOwner, store: ProgressStore | null) =>
    this.active &&
    matchesAuthOwner(this.authStore.getSnapshot(), owner) &&
    this.owner !== null &&
    sameProgressOwner(this.owner, owner) &&
    this.store === store;
  private async disposeStore(clearPending = false) {
    setActiveProgressStore(null);
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    const store = this.store;
    this.store = this.owner = null;
    if (store) await store.dispose(clearPending);
  }
}
