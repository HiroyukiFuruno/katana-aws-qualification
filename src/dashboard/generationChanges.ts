export function createDashboardGenerationChanges() {
  let generation: number | undefined;
  let revision = 0;
  const listeners = new Set<() => void>();
  return {
    accept(value: number) {
      const changed = generation !== undefined && generation !== value;
      generation = value;
      if (!changed) return;
      revision++;
      for (const listener of listeners) listener();
    },
    observer: {
      getSnapshot: () => revision,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
}
