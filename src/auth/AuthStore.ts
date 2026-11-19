import type { AccountAuth, AuthState } from './types';

export class AuthStore {
  private state: AuthState;
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  constructor(
    readonly service: AccountAuth | null,
    configurationError = false,
  ) {
    this.state = {
      status: configurationError ? 'error' : service ? 'loading' : 'unavailable',
      account: null,
    };
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(state: AuthState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  start() {
    const service = this.service;
    if (!service) return () => {};
    let active = true;
    const reconcile = () => {
      const revision = ++this.revision;
      this.update({ status: 'loading', account: null });
      Promise.resolve()
        .then(() => service.getAccount())
        .then(
          (account) => {
            if (active && revision === this.revision) this.update({ status: 'ready', account });
          },
          () => {
            if (active && revision === this.revision) this.update({ status: 'error', account: null });
          },
        );
    };
    const unsubscribe = service.subscribe((account) => {
      if (!active) return;
      if (account) reconcile();
      else {
        this.revision++;
        this.update({ status: 'ready', account: null });
      }
    });
    reconcile();
    return () => {
      active = false;
      unsubscribe();
    };
  }
}
