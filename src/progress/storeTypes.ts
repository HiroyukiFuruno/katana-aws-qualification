import type { Attempt } from '../attempts';
import type { ExamDraft, ExamResponse } from '../exam';
import type { ExamFinalizationEvent } from './examFinalization';
import type { BrowserStorage } from './guest';
import { emptyProfile, type Profile } from './profileTypes';
import type { ProgressOwner, ProgressRpcClient } from './types';

export type ProgressSnapshot = {
  attempts: Attempt[];
  corruptRows: number;
  error?: 'load' | 'save' | 'reset';
  owner: ProgressOwner;
  profile: Profile;
  profileRevision: number;
  refreshing?: boolean;
  state: 'error' | 'loading' | 'ready';
};
export type ProgressReadyData = Pick<
  ProgressSnapshot,
  'attempts' | 'corruptRows' | 'profile' | 'profileRevision'
>;
export type ProgressStore = {
  appendAttempt(
    certificationId: string,
    attempt: Attempt,
    prepare?: (history: Attempt[]) => Attempt,
  ): Promise<Attempt>;
  dispose(clearPending?: boolean): Promise<void>;
  finalizeExam(draft: ExamDraft, events: ExamFinalizationEvent[]): Promise<string>;
  getSnapshot(): ProgressSnapshot;
  initialize(): Promise<ProgressSnapshot>;
  loadExam(certificationId: string): Promise<ExamDraft | undefined>;
  readExamClock(): Promise<string>;
  replaceProfile(profile: Profile): Promise<void>;
  reset(): Promise<void>;
  retryPending(): Promise<void>;
  saveExamResponse(
    draft: ExamDraft,
    position: number,
    key: string,
    response: ExamResponse,
  ): Promise<ExamDraft>;
  startExam(
    draft: ExamDraft,
    certificationId: string,
    sourceVersion: string,
    durationMs: number,
  ): Promise<ExamDraft>;
  subscribe(listener: () => void): () => void;
};
export type ProgressStoreInput = {
  client?: ProgressRpcClient;
  isCurrent: () => boolean;
  onStaleGeneration?: () => void;
  onProfileConflict?: () => void;
  owner: ProgressOwner;
  storage: BrowserStorage;
};

export function initialProgressSnapshot(owner: ProgressOwner): ProgressSnapshot {
  return {
    attempts: [],
    corruptRows: 0,
    owner,
    profile: emptyProfile(),
    profileRevision: 0,
    state: 'loading',
  };
}
