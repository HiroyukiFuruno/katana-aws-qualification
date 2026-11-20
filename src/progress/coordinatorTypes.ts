import type { ProgressStore } from './storeTypes';

export type ProgressConfiguration = { key: string; url: string };
export type ProgressCoordinatorSnapshot = {
  status: 'error' | 'loading' | 'ready';
  store: ProgressStore | null;
};
