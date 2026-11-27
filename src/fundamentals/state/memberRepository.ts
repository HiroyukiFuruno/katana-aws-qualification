import type { ProgressRpcClient } from '../../progress/types';
import type { LessonRecordAsset, LessonRecordQuestion } from '../delivery/recordAsset';
import { strings } from './codecPrimitives';
import {
  type LessonSummaryReference,
  readLessonHistorySummaries,
  readLessonSummaries,
} from './memberSummary';
import type { LessonSummary, MemberLessonRepository } from './memberTypes';
import { readLessonSnapshot } from './snapshotCodec';

type Input = { client: ProgressRpcClient; isCurrent: () => boolean };

export function createMemberLessonRepository({ client, isCurrent }: Input): MemberLessonRepository & {
  historySummaries(currentUnits: LessonSummaryReference[]): Promise<LessonSummary[]>;
  checkpointSelection(
    asset: LessonRecordAsset,
    question: LessonRecordQuestion,
  ): Promise<string[] | undefined>;
} {
  let generation: number | undefined;
  const current = () => {
    if (!isCurrent()) throw new Error('Progress owner changed');
  };
  const snapshot = (raw: unknown, asset: LessonRecordAsset) => {
    current();
    return readLessonSnapshot(raw, asset);
  };
  const ready = () => {
    if (generation === undefined) throw new Error('Lesson repository is not initialized');
    return generation;
  };
  const receipt = (value: string) => {
    if (!value) throw new Error('A lesson receipt identifier is required');
    return value;
  };
  return {
    async initialize() {
      current();
      const value = await client.rpc<unknown>('initialize_learning_state', {});
      current();
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
        throw new Error('Invalid learning generation');
      generation = value;
      return value;
    },
    async load(asset) {
      current();
      const raw = await client.rpc<unknown>('load_fundamentals_snapshot', {
        p_unit_id: asset.unit.id,
        p_content_version: asset.contentVersion,
        p_expected_generation: ready(),
      });
      return snapshot(raw, asset);
    },
    async recordStep(asset, input) {
      current();
      const raw = await client.rpc<unknown>('record_fundamentals_step', {
        p_unit_id: asset.unit.id,
        p_content_version: asset.contentVersion,
        p_kind: input.selected ? 'checkpoint' : 'slide',
        p_step_id: input.stepId,
        p_selected: input.selected ?? null,
        p_expected_revision: input.expectedRevision,
        p_expected_generation: ready(),
        p_receipt_id: receipt(input.receiptId),
        p_duration_ms: input.durationMs,
      });
      return snapshot(raw, asset);
    },
    async saveResponse(asset, input) {
      current();
      const question = asset.finalQuestions[input.position];
      if (!question) throw new Error('Invalid final response position');
      const raw = await client.rpc<unknown>('save_fundamentals_final_response', {
        p_session_id: input.sessionId,
        p_expected_revision: input.expectedRevision,
        p_position: input.position,
        p_question_ref: {
          questionId: question.id,
          revision: question.revision,
          sourceVersion: question.version,
        },
        p_selected: input.selected,
        p_expected_generation: ready(),
        p_receipt_id: receipt(input.receiptId),
        p_duration_ms: input.durationMs,
        p_cursor_position: input.cursorPosition,
      });
      return snapshot(raw, asset);
    },
    async startFinal(asset, input) {
      current();
      const raw = await client.rpc<unknown>('start_fundamentals_final', {
        p_session_id: input.sessionId,
        p_unit_id: asset.unit.id,
        p_content_version: asset.contentVersion,
        p_expected_progress_revision: input.expectedRevision,
        p_expected_generation: ready(),
      });
      return snapshot(raw, asset);
    },
    async finalize(asset, input) {
      current();
      const raw = await client.rpc<unknown>('finalize_fundamentals_final', {
        p_session_id: input.sessionId,
        p_expected_revision: input.expectedRevision,
        p_expected_generation: ready(),
      });
      return snapshot(raw, asset);
    },
    async summaries(units) {
      current();
      const raw = await client.rpc<unknown>('load_fundamentals_progress_summaries', {
        p_units: units,
        p_expected_generation: ready(),
      });
      current();
      return readLessonSummaries(raw, units);
    },
    async historySummaries(currentUnits) {
      current();
      const raw = await client.rpc<unknown>('load_fundamentals_history_summaries', {
        p_current_units: currentUnits,
        p_expected_generation: ready(),
      });
      current();
      return readLessonHistorySummaries(raw, currentUnits);
    },
    async checkpointSelection(asset, question) {
      current();
      const raw = await client.rpc<unknown>('load_fundamentals_checkpoint_selection', {
        p_unit_id: asset.unit.id,
        p_content_version: asset.contentVersion,
        p_question_id: question.id,
        p_question_revision: question.revision,
        p_source_version: question.version,
        p_expected_generation: ready(),
      });
      current();
      return raw === null ? undefined : strings(raw, 'previous selected choices');
    },
  };
}
