import type { Locale } from '../../locales';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { lessonInstant } from '../state/instant';
import type { LessonFinalSession } from '../state/types';

export function submittedSession(sessions: readonly LessonFinalSession[], sessionId?: string) {
  const submitted = sessions.filter((session) => session.state === 'submitted');
  if (sessionId) return submitted.find((session) => session.sessionId === sessionId);
  return [...submitted]
    .sort((left, right) => {
      if (!left.submittedAt || !right.submittedAt) throw new Error('Submitted lesson time is missing.');
      const leftTime = lessonInstant(left.submittedAt);
      const rightTime = lessonInstant(right.submittedAt);
      return leftTime < rightTime
        ? -1
        : leftTime > rightTime
          ? 1
          : left.sessionId.localeCompare(right.sessionId);
    })
    .at(-1);
}

export function selectedSetMatches(
  question: DeliveryUnitAsset['finalQuestions'][number],
  selected: readonly string[],
) {
  return (
    selected.length === question.correct.length &&
    selected.every((choice) => question.correct.includes(choice)) &&
    question.correct.every((choice) => selected.includes(choice))
  );
}

export function questionPosition(questionId: string, asset: DeliveryUnitAsset) {
  const position = asset.finalQuestions.findIndex((question) => question.id === questionId);
  return position >= 0 ? position + 1 : undefined;
}

export function reviewPath(asset: DeliveryUnitAsset, sectionId: string, locale: Locale) {
  const step =
    asset.steps.find((candidate) => candidate.kind === 'reading' && candidate.sectionId === sectionId) ??
    asset.steps.find((candidate) => candidate.kind === 'reading');
  return step
    ? lessonPath({ locale, unitId: asset.unit.id, stage: 'slides', position: step.position })
    : undefined;
}
