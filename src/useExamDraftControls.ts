import type { MutableRefObject, RefObject } from 'react';
import type { ExamBlueprint } from './certifications';
import { canStartExam, type ExamDraft, type ExamResponse, getResponse } from './exam';
import { elapsedExamMs, examNow } from './examClock';
import { loadOrStartExam } from './examStart';
import { persistMemberResponse } from './examSubmissionMember';
import type { Attempt } from './history';
import type { Message } from './messages';
import type { ProgressStore } from './progress/storeTypes';
import type { Question } from './questions';

type DraftControlsInput = {
  activeSince: RefObject<number>;
  bank: Question[];
  blueprint: ExamBlueprint;
  certificationId: string;
  draft: ExamDraft | undefined;
  examKey: string;
  failedAuto: MutableRefObject<boolean>;
  history: Attempt[];
  onStart: () => void;
  progressStore: ProgressStore | null | undefined;
  savePending: MutableRefObject<boolean>;
  setSaving: (saving: boolean) => void;
  setDraft: (draft: ExamDraft | undefined) => void;
  setError: (error: Message | '') => void;
  setNow: (now: number) => void;
};
function memberStore(store: ProgressStore | null | undefined) {
  return store?.getSnapshot().owner.kind === 'member' ? store : undefined;
}
function guestStore(store: ProgressStore | null | undefined) {
  return store?.getSnapshot().owner.kind === 'guest' ? store : undefined;
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
  savePending,
  setDraft,
  setError,
  setSaving,
  setNow,
}: DraftControlsInput) {
  const available = canStartExam(bank, blueprint);
  async function start(count: number) {
    if (!available || savePending.current) return;
    let saving = false;
    try {
      savePending.current = true;
      saving = true;
      setSaving(true);
      const started = await loadOrStartExam({
        bank,
        blueprint,
        certificationId,
        count,
        draft,
        examKey,
        history,
        store: progressStore,
      });
      setDraft(started);
      setNow(examNow(started));
      activeSince.current = performance.now();
      failedAuto.current = false;
      onStart();
      setError('');
    } catch {
      setError('examSaveFailed');
    } finally {
      if (saving) {
        savePending.current = false;
        setSaving(false);
      }
    }
  }
  async function update(position: number, patch: Partial<ExamResponse> = {}) {
    if (savePending.current) return;
    const at = draft ? examNow(draft) : Date.now();
    if (!draft || at >= draft.deadline) {
      setNow(at);
      return;
    }
    let saving = false;
    try {
      const member = memberStore(progressStore);
      const guest = guestStore(progressStore);
      const current = guest ? guest.readGuestExam(examKey) : draft;
      if (!current || current.id !== draft.id || current.position !== draft.position) return;
      savePending.current = true;
      saving = true;
      setSaving(true);
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
      if (member)
        saved = await persistMemberResponse(
          member,
          certificationId,
          current,
          key,
          next.responses[key],
          position,
        );
      else if (guest) await guest.saveGuestExam(examKey, next);
      else throw new Error('Progress store is unavailable.');
      activeSince.current = performance.now();
      setDraft(saved);
      setError('');
    } catch {
      setError('answerSaveFailed');
    } finally {
      if (saving) {
        savePending.current = false;
        setSaving(false);
      }
    }
  }
  return { available, start, update };
}
