import type { Locale } from '../../locales';
import type { LessonSnapshot } from '../state/types';
import type { DeliveryUnitAsset } from './artifactTypes';
import { type LessonRoute, lessonPath } from './navigation';
import type { LessonStep } from './slideTypes';

export function stepHref(
  locale: Locale,
  step: LessonStep,
  asset: DeliveryUnitAsset,
  contentVersion?: string,
) {
  const finalPosition = asset.steps.filter((item) => item.kind === 'final').indexOf(step) + 1;
  return lessonPath({
    locale,
    unitId: asset.unit.id,
    stage: step.kind === 'final' ? 'final' : step.kind === 'checkpoint' ? 'checkpoints' : 'slides',
    position: step.kind === 'final' ? finalPosition : step.position,
    contentVersion,
  });
}

export function resumeLessonHref(
  locale: Locale,
  asset: DeliveryUnitAsset,
  snapshot: LessonSnapshot,
  contentVersion?: string,
) {
  const active = snapshot.sessions.find(
    (session) => session.sessionId === snapshot.progress.activeFinalSessionId,
  );
  if (active) {
    return lessonPath({
      locale,
      unitId: asset.unit.id,
      stage: 'final',
      position: active.position + 1,
      contentVersion,
    });
  }
  if (snapshot.progress.resumeStage === 'result') {
    return lessonPath({ locale, unitId: asset.unit.id, stage: 'result', contentVersion });
  }
  const plan = asset.steps.filter((step) => step.kind !== 'final');
  const step = plan[snapshot.progress.furthestPlanPosition];
  return step
    ? stepHref(locale, step, asset, contentVersion)
    : lessonPath({ locale, unitId: asset.unit.id, stage: 'final', position: 1, contentVersion });
}

export function routedLessonStep(route: LessonRoute, asset: DeliveryUnitAsset) {
  if (route.stage === 'resume' || route.stage === 'result') return undefined;
  if (typeof route.position !== 'number') throw new Error('A lesson step position is required.');
  if (route.stage === 'final') {
    return asset.steps.filter((step) => step.kind === 'final')[route.position - 1];
  }
  const step = asset.steps[route.position - 1];
  return step &&
    step.kind !== 'final' &&
    (route.stage === 'checkpoints' ? step.kind === 'checkpoint' : step.kind !== 'checkpoint')
    ? step
    : undefined;
}

export function reachableLessonHref(
  route: LessonRoute,
  asset: DeliveryUnitAsset,
  snapshot: LessonSnapshot,
) {
  if (route.stage === 'resume')
    return resumeLessonHref(route.locale, asset, snapshot, route.contentVersion);
  const nonFinal = asset.steps.filter((step) => step.kind !== 'final');
  if (route.stage === 'result') {
    return snapshot.sessions.some((session) => session.state === 'submitted')
      ? undefined
      : resumeLessonHref(route.locale, asset, snapshot, route.contentVersion);
  }
  const step = routedLessonStep(route, asset);
  if (!step) throw new Error('This lesson step does not exist.');
  if (
    step.kind === 'final'
      ? snapshot.progress.furthestPlanPosition < nonFinal.length
      : step.position > snapshot.progress.furthestPlanPosition + 1
  ) {
    return resumeLessonHref(route.locale, asset, snapshot, route.contentVersion);
  }
  return undefined;
}
