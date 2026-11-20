import { useEffect, useRef } from 'react';
import type { Locale } from '../../locales';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { stepHref } from '../delivery/planNavigation';
import type { LessonStep } from '../delivery/slideTypes';
import type { LessonCommand } from '../state/outboxTypes';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { useLessonMutation } from '../state/useLessonMutation';

type Input = {
  services: LessonServices;
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  step: LessonStep;
  locale: Locale;
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
  const resultHref = lessonPath({ locale, unitId: asset.unit.id, stage: 'result' });
  const active = snapshot.sessions.find(
    (session) => session.sessionId === snapshot.progress.activeFinalSessionId,
  );
  const finalPosition = asset.steps.filter((item) => item.kind === 'final').indexOf(step);
  function finalCommand(confirmed: LessonSnapshot): LessonCommand {
    const session = confirmed.sessions.find(
      (item) => item.sessionId === confirmed.progress.activeFinalSessionId,
    );
    if (!session) throw new Error('The lesson final session is missing.');
    return {
      ...base(),
      kind: 'finalize',
      input: { sessionId: session.sessionId, expectedRevision: session.revision },
    };
  }
  const start = () =>
    mutation.execute(
      {
        ...base(),
        kind: 'startFinal',
        input: { sessionId: crypto.randomUUID(), expectedRevision: snapshot.progress.revision },
      },
      (result) =>
        confirm(result, lessonPath({ locale, unitId: asset.unit.id, stage: 'final', position: 1 })),
    );
  function saveFinal(cursorPosition: number, href: string, submit = false) {
    if (!active) return start();
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
      submit ? finalCommand : undefined,
    );
  }
  function next() {
    const next = asset.steps[step.position];
    const href = next ? stepHref(locale, next, asset) : resultHref;
    if (step.kind === 'final') {
      return saveFinal(Math.min(finalPosition + 1, 11), href, finalPosition === 11);
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
