export class RoadmapProfileSaveGuard {
  #pending = false;
  #token = 0;
  #owner: string | undefined;
  #store: unknown;

  get pending() {
    return this.#pending;
  }

  invalidate(owner: string, store: unknown, setSaving: (saving: boolean) => void) {
    if (this.#owner === owner && this.#store === store) return;
    this.#owner = owner;
    this.#store = store;
    this.#token += 1;
    this.#pending = false;
    setSaving(false);
  }

  async run<T>(operation: () => Promise<T>, setSaving: (saving: boolean) => void) {
    if (this.#pending) return { accepted: false, current: false };
    const token = ++this.#token;
    this.#pending = true;
    setSaving(true);
    try {
      const value = await operation();
      return { accepted: true, current: token === this.#token, value };
    } finally {
      if (token === this.#token) {
        this.#pending = false;
        setSaving(false);
      }
    }
  }
}
