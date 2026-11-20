import type { GuestProgressRepository } from './guest';
import type { MemberProgressRepository } from './member';
import type { MemberRetryQueue } from './retryQueue';
import type * as StoreTypes from './storeTypes';

export type StoreActionDependencies = {
  failed: (error: StoreTypes.ProgressSnapshot['error'], preserveReady?: boolean) => void;
  getSnapshot: () => StoreTypes.ProgressSnapshot;
  getSnapshotVersion: () => number;
  guest?: GuestProgressRepository;
  loading: () => void;
  member?: MemberProgressRepository;
  queue?: MemberRetryQueue;
  ready: (next: StoreTypes.ProgressReadyData) => void;
  setGeneration: (generation: number) => Promise<void>;
};
