import type { LessonStep } from '../delivery/slideTypes';

function introduction(steps: readonly LessonStep[]) {
  const end = steps.findIndex((step) => step.kind !== 'intro');
  return steps.slice(0, end < 0 ? steps.length : end);
}

export function lessonSlidePresentation(steps: readonly LessonStep[], step: LessonStep) {
  const intro = introduction(steps);
  const lead = intro[0];
  const hidden = Math.max(0, intro.length - 1);
  const isIntro = Boolean(lead && step.position <= intro.length);
  const totalSteps = step.totalSteps - hidden;
  const position = isIntro ? 1 : step.position - hidden;
  return {
    display: {
      ...(isIntro ? lead : step),
      position,
      totalSteps,
      remainingSteps: totalSteps - position,
      estimatedSeconds: isIntro ? lead.estimatedSeconds : step.estimatedSeconds,
    },
    optionalObjectives: isIntro ? intro.slice(1) : [],
    lastPosition: isIntro ? intro.length : step.position,
    previous: isIntro
      ? undefined
      : step.position === intro.length + 1 && lead
        ? lead
        : steps[step.position - 2],
  };
}
