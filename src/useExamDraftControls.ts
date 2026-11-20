import type { MutableRefObject, RefObject } from 'react';
import type { ExamBlueprint } from './certifications';
import { canStartExam, type ExamResponse, getResponse, newExam, readExam, storeExam } from './exam';
import { elapsedExamMs, examNow } from './examClock';
import type { Attempt } from './history';
import type { Message } from './messages';
import type { ProgressStore } from './progress/storeTypes';
import type { Question } from './questions';

type DraftControlsInput = {
  activeSince: RefObject<number>;
  bank: Question[];
  blueprint: ExamBlueprint;
  certificationId: string;
  draft: ReturnType<typeof readExam>;
  examKey: string;
  failedAuto: MutableRefObject<boolean>;
  history: Attempt[];
  onStart: () => void;
  progressStore: ProgressStore | null | undefined;
  setDraft: (draft: ReturnType<typeof readExam>) => void;
  setError: (error: Message | '') => void;
  setNow: (now: number) => void;
};

function memberStore(store: ProgressStore | null | undefined) {
  return store?.getSnapshot().owner.kind === 'member' ? store : undefined;
}

export function useExamDraftControls({
  activeSince,
  bank,
  blueprint,
  certificationId,
  draft,
  examKey,
  failedAuto,
  history,
  onStart,
  progressStore,
  setDraft,
  setError,
  setNow,
}: DraftControlsInput) {
  const available = canStartExam(bank, blueprint);
  async function start(count: number) {
    if (!available) return;
    try {
      const member = memberStore(progressStore);
      const current = member ? draft : readExam(examKey);
      if (current && !history.some((attempt) => attempt.examId === current.id)) {
        setDraft(current);
        return;
      }
      const next = newExam(bank, blueprint, Date.now(), count);
      let started = next;
      if (member) {
        started = await member.startExam(
          next,
          certificationId,
          bank[0]?.version ?? 'current',
          next.deadline - Date.now(),
        );
      } else storeExam(examKey, next);
      setDraft(started);
      setNow(examNow(started));
      activeSince.current = performance.now();
      failedAuto.current = false;
      onStart();
      setError('');
    } catch {
      setError('examSaveFailed');
    }
  }
  async function update(position: number, patch: Partial<ExamResponse> = {}) {
    const at = draft ? examNow(draft) : Date.now();
    if (!draft || at >= draft.deadline) {
      setNow(at);
      return;
    }
    try {
      const member = memberStore(progressStore);
      const current = member ? draft : readExam(examKey);
      if (!current || current.id !== draft.id || current.position !== draft.position) return;
      const key = current.order[current.position];
      const response = getResponse(current, key);
      const merged = { ...response, ...patch };
      const next = {
        ...current,
        position,
        responses: {
          ...current.responses,
          [key]: {
            ...merged,
            durationMs: merged.selected.length
              ? response.durationMs + elapsedExamMs(activeSince.current)
              : 0,
          },
        },
      };
      let saved = next;
      if (member) saved = await member.saveExamResponse(next, position, key, next.responses[key]);
      else storeExam(examKey, next);
      activeSince.current = performance.now();
      setDraft(saved);
      setError('');
    } catch {
      setError('answerSaveFailed');
    }
  }
  return { available, start, update };
}
