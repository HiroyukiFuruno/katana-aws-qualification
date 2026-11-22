import { useEffect, useRef } from 'react';
import type { Locale } from '../../locales';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { stepHref } from '../delivery/planNavigation';
import type { LessonStep } from '../delivery/slideTypes';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { useLessonMutation } from '../state/useLessonMutation';
import { finalizeLessonCommand } from './finalizeLessonCommand';
import { createRandomizedFinalSessionId } from './lesson-presentation';

type Input = {
  services: LessonServices;
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  step: LessonStep;
  locale: Locale;
  contentVersion?: string;
  finalPosition?: number;
  presentationPosition: number;
  selected: string[];
  confirm: (snapshot: LessonSnapshot, href?: string) => void;
  commit: (snapshot: LessonSnapshot) => void;
};

export function useLessonActions({
  services,
  asset,
  snapshot,
  step,
  locale,
  contentVersion,
  finalPosition,
  presentationPosition,
  selected,
  confirm,
  commit,
}: Input) {
  const mutation = useLessonMutation(services, asset, commit);
  const began = useRef(performance.now());
  useEffect(() => {
    if (step.id) began.current = performance.now();
  }, [step.id]);
  const duration = () =>
    Math.min(86_400_000, Math.max(0, Math.round(performance.now() - began.current)));
  const base = () => ({
    commandId: crypto.randomUUID(),
    unitId: asset.unit.id,
    contentVersion: asset.contentVersion,
  });
  const resultHref = lessonPath({ locale, unitId: asset.unit.id, stage: 'result', contentVersion });
  const active = snapshot.sessions.find(
    (session) => session.sessionId === snapshot.progress.activeFinalSessionId,
  );
  const start = () =>
    mutation.execute(
      {
        ...base(),
        kind: 'startFinal',
        input: {
          sessionId: createRandomizedFinalSessionId(),
          expectedRevision: snapshot.progress.revision,
        },
      },
      (result) =>
        confirm(
          result,
          lessonPath({ locale, unitId: asset.unit.id, stage: 'final', position: 1, contentVersion }),
        ),
    );
  function saveFinal(cursorPosition: number, href: string, submit = false) {
    if (!active) return start();
    if (finalPosition === undefined) throw new Error('The lesson final position is missing.');
    return mutation.execute(
      {
        ...base(),
        kind: 'saveResponse',
        input: {
          sessionId: active.sessionId,
          expectedRevision: active.revision,
          position: finalPosition,
          receiptId: crypto.randomUUID(),
          selected: [...selected],
          durationMs: duration(),
          cursorPosition,
        },
      },
      (result) => confirm(result, href),
      submit ? (result) => finalizeLessonCommand(result, base()) : undefined,
    );
  }
  function next() {
    const next = asset.steps[step.position];
    const href = next ? stepHref(locale, next, asset, contentVersion) : resultHref;
    if (step.kind === 'final') {
      const nextPosition = Math.min(presentationPosition + 1, 11);
      const nextHref =
        presentationPosition === 11
          ? resultHref
          : lessonPath({
              locale,
              unitId: asset.unit.id,
              stage: 'final',
              position: presentationPosition + 2,
              contentVersion,
            });
      return saveFinal(nextPosition, nextHref, presentationPosition === 11);
    }
    if (step.kind === 'checkpoint') {
      confirm(snapshot, href);
      return Promise.resolve();
    }
    return mutation.execute(
      {
        ...base(),
        kind: 'recordStep',
        input: {
          stepId: step.id,
          expectedRevision: snapshot.progress.revision,
          receiptId: crypto.randomUUID(),
          durationMs: duration(),
        },
      },
      (result) => confirm(result, href),
    );
  }
  function checkpoint() {
    return mutation.execute(
      {
        ...base(),
        kind: 'recordStep',
        input: {
          stepId: step.id,
          expectedRevision: snapshot.progress.revision,
          receiptId: crypto.randomUUID(),
          durationMs: duration(),
          selected: [...selected],
        },
      },
      (result) => confirm(result),
    );
  }
  return { ...mutation, next, checkpoint, start, saveFinal };
}
