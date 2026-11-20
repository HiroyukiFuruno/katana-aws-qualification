import type { ExamDraft } from '../exam';

function validResponse(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as { durationMs?: unknown; flagged?: unknown; selected?: unknown };
  return (
    Array.isArray(response.selected) &&
    response.selected.every((selected) => typeof selected === 'string') &&
    typeof response.flagged === 'boolean' &&
    typeof response.durationMs === 'number' &&
    Number.isFinite(response.durationMs) &&
    response.durationMs >= 0
  );
}

export function isGuestExamDraft(value: unknown): value is ExamDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as {
    deadline?: unknown;
    id?: unknown;
    order?: unknown;
    position?: unknown;
    responses?: unknown;
  };
  return (
    typeof draft.id === 'string' &&
    Number.isFinite(draft.deadline) &&
    Array.isArray(draft.order) &&
    draft.order.every((key) => typeof key === 'string') &&
    typeof draft.position === 'number' &&
    Number.isSafeInteger(draft.position) &&
    draft.position >= 0 &&
    draft.position <= draft.order.length &&
    !!draft.responses &&
    typeof draft.responses === 'object' &&
    !Array.isArray(draft.responses) &&
    Object.values(draft.responses).every(validResponse)
  );
}
