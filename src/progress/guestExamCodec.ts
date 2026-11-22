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
    choiceOrders?: unknown;
    deadline?: unknown;
    id?: unknown;
    order?: unknown;
    position?: unknown;
    responses?: unknown;
  };
  const order = Array.isArray(draft.order) ? draft.order : [];
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
    Object.values(draft.responses).every(validResponse) &&
    (draft.choiceOrders === undefined ||
      (typeof draft.choiceOrders === 'object' &&
        draft.choiceOrders !== null &&
        !Array.isArray(draft.choiceOrders) &&
        Object.entries(draft.choiceOrders).every(
          ([key, choices]) =>
            order.includes(key) &&
            Array.isArray(choices) &&
            choices.length > 0 &&
            choices.length <= 20 &&
            choices.every(
              (choice) => typeof choice === 'string' && choice.length > 0 && choice.length <= 160,
            ) &&
            new Set(choices).size === choices.length,
        )))
  );
}
