import type { Question } from '../questions';
import type { MemberProgressOwner, ProgressRpcClient } from './types';

export type LegacySourceName =
  | 'history-local-storage'
  | 'wrong-cookie-v1'
  | 'wrong-index-local-storage'
  | 'exam-draft-local-storage'
  | 'profile-local-storage';
export type LegacyStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  keys(): readonly string[];
  readIncorrectCookie(): string | null;
  expireIncorrectCookie(): void;
};
export type LegacyQuestionResolution = { certificationId: string; question: Question };
export type LegacyQuestionResolver = (
  questionId: string,
  revision: number,
) => Promise<LegacyQuestionResolution | undefined>;
export type LegacyMigrationInput = {
  owner: MemberProgressOwner;
  client: ProgressRpcClient;
  isCurrent: () => boolean;
  storage: LegacyStorage;
  resolveQuestion: LegacyQuestionResolver;
};
export type LegacyPreviewSource = {
  sourceName: LegacySourceName;
  key: string;
  raw: string | null;
  rows: number;
  errors: number;
};
export type LegacyMigrationPreview = {
  sources: readonly LegacyPreviewSource[];
  errors: number;
  rows: number;
};
export type LegacyMigrationReport = {
  imported: number;
  rejected: number;
  failed: number;
  retained: number;
  sources: readonly LegacyMigrationSourceReport[];
};
export type LegacyMigrationSourceReport = {
  sourceName: LegacySourceName;
  imported: number;
  rejected: number;
  failed: number;
  removed: boolean;
};
