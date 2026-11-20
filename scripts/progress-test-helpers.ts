import type { ProgressCoordinator } from '../src/progress/ProgressCoordinator';

export function waitForStatus(coordinator: ProgressCoordinator, status: 'error' | 'ready') {
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

export function waitForGuest(coordinator: ProgressCoordinator) {
  const matches = () => coordinator.getSnapshot().store?.getSnapshot().owner.kind === 'guest';
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
