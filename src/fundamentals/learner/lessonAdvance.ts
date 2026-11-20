import type { LessonStep } from '../delivery/slideTypes';

type Input = {
  blocked: boolean;
  kind: LessonStep['kind'];
  active: boolean;
  feedback: boolean;
  requiredChoices?: number;
  selectedCount: number;
};

export function canAdvanceLesson(input: Input) {
  if (input.blocked) return false;
  if (input.kind === 'checkpoint') return input.feedback;
  if (input.kind === 'final' && input.active)
    return (
      input.requiredChoices !== undefined &&
      input.requiredChoices > 0 &&
      input.selectedCount === input.requiredChoices
    );
  return true;
}
