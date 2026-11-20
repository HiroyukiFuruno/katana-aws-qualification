import type { BrowserStorage } from '../../progress/guest';
import type { MemberProgressOwner, ProgressRpcClient } from '../../progress/types';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { GuestLessonSource, LessonSnapshot } from './types';

export type LessonMigrationAccess = {
  client: ProgressRpcClient;
  isCurrent: () => boolean;
  owner: MemberProgressOwner;
  refresh: () => Promise<void>;
};

export type GuestLessonImport = {
  asset: DeliveryUnitAsset;
  key: string;
  raw: string;
  source: GuestLessonSource;
};

export type LessonImportResult = {
  manifestId: string;
  removed: boolean;
  snapshot: LessonSnapshot;
};

export type LessonMigrationInput = {
  access: LessonMigrationAccess;
  asset: DeliveryUnitAsset;
  storage: BrowserStorage;
};
