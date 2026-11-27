import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonStep } from '../delivery/slideTypes';
import type { LessonCommand } from '../state/outboxTypes';
import type { LessonSnapshot } from '../state/types';
import type { useLessonMutation } from '../state/useLessonMutation';

type Input = {
  asset: DeliveryUnitAsset;
  step: LessonStep;
  lastPosition: number;
  snapshot: LessonSnapshot;
  base: () => Pick<LessonCommand, 'commandId' | 'unitId' | 'contentVersion'>;
  duration: () => number;
  execute: ReturnType<typeof useLessonMutation>['execute'];
  done: (snapshot: LessonSnapshot) => void;
};

export function advanceReading({
  asset,
  step,
  lastPosition,
  snapshot,
  base,
  duration,
  execute,
  done,
}: Input) {
  function command(
    target: LessonStep,
    saved: LessonSnapshot,
  ): Extract<LessonCommand, { kind: 'recordStep' }> {
    return {
      ...base(),
      kind: 'recordStep',
      input: {
        stepId: target.id,
        expectedRevision: saved.progress.revision,
        receiptId: crypto.randomUUID(),
        durationMs: target.id === step.id ? duration() : 0,
      },
    };
  }
  if (step.kind !== 'intro') return execute(command(step, snapshot), done);

  function nextIntro(saved: LessonSnapshot) {
    const pending = asset.steps[saved.progress.furthestPlanPosition];
    if (pending?.kind === 'intro' && pending.position <= lastPosition) return command(pending, saved);
  }
  const first = nextIntro(snapshot);
  if (!first) {
    done(snapshot);
    return Promise.resolve();
  }
  return execute(first, done, (result, completed) => {
    const next = nextIntro(result);
    if (next && completed.kind === 'recordStep' && next.input.stepId === completed.input.stepId)
      throw new Error('Lesson introduction progress did not advance.');
    return next;
  });
}
