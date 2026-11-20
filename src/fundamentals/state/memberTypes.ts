import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonSnapshot } from './types';

export type LessonSummary = {
  activeFinalSessionId: string | null;
  completedCheckpoints: number;
  completedSlides: number;
  contentVersion: string;
  latestScore: number | null;
  passedAt: string | null;
  requiredScore: number | null;
  totalCheckpoints: number;
  totalSlides: number;
  unitId: string;
};

export type MemberLessonRepository = {
  finalize(
    asset: DeliveryUnitAsset,
    input: { expectedRevision: number; sessionId: string },
  ): Promise<LessonSnapshot>;
  initialize(): Promise<number>;
  load(asset: DeliveryUnitAsset): Promise<LessonSnapshot>;
  recordStep(
    asset: DeliveryUnitAsset,
    input: {
      durationMs: number;
      expectedRevision: number;
      receiptId: string;
      selected?: string[];
      stepId: string;
    },
  ): Promise<LessonSnapshot>;
  saveResponse(
    asset: DeliveryUnitAsset,
    input: {
      cursorPosition: number;
      durationMs: number;
      expectedRevision: number;
      position: number;
      receiptId: string;
      selected: string[];
      sessionId: string;
    },
  ): Promise<LessonSnapshot>;
  startFinal(
    asset: DeliveryUnitAsset,
    input: { expectedRevision: number; sessionId: string },
  ): Promise<LessonSnapshot>;
  summaries(units: { contentVersion: string; unitId: string }[]): Promise<LessonSummary[]>;
};
