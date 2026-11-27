import { useEffect, useRef } from 'react';
import type { Locale } from '../../locales';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { stepHref } from '../delivery/planNavigation';
import type { LessonStep } from '../delivery/slideTypes';
import type { LessonServices } from '../state/services';
import { exitLesson } from './exitLesson';
import { canAdvanceLesson } from './lessonAdvance';
import type { useLessonActions } from './useLessonActions';

type Input = {
  asset: DeliveryUnitAsset;
  services: LessonServices;
  actions: Pick<ReturnType<typeof useLessonActions>, 'pending' | 'saveFinal' | 'getPendingCommand'>;
  step: LessonStep;
  previousStep?: LessonStep;
  active: boolean;
  question?: { requiredChoices: number };
  selectedCount: number;
  feedback: boolean;
  position: number;
  locale: Locale;
  contentVersion?: string;
  catalogHref: string;
  blocked: boolean;
  saving: boolean;
  go: (href: string) => void;
};

export function useLessonNavigation(input: Input) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const path = location.pathname + location.search;
  const final = input.step.kind === 'final' && input.active;
  const nextLabelKey: 'fundamentalsStartPractice' | 'lessonFinalSubmit' | undefined =
    input.step.kind === 'final' && !input.active
      ? 'fundamentalsStartPractice'
      : input.step.kind === 'final' && input.position === 11
        ? 'lessonFinalSubmit'
        : undefined;
  const previous = input.previousStep;
  const previousHref = final
    ? input.position > 0
      ? lessonPath({
          locale: input.locale,
          unitId: input.asset.unit.id,
          stage: 'final',
          position: input.position,
          contentVersion: input.contentVersion,
        })
      : previous
        ? stepHref(input.locale, previous, input.asset, input.contentVersion)
        : undefined
    : previous
      ? stepHref(input.locale, previous, input.asset, input.contentVersion)
      : undefined;
  return {
    previousHref: input.blocked ? undefined : previousHref,
    nextAllowed: canAdvanceLesson({
      blocked: input.blocked,
      kind: input.step.kind,
      active: input.active,
      requiredChoices: input.question?.requiredChoices,
      selectedCount: input.selectedCount,
      feedback: input.feedback,
    }),
    nextLabelKey,
    saving: input.saving,
    catalog: () =>
      exitLesson({
        busy: input.saving,
        final,
        pending: input.actions.pending || input.blocked,
        isCurrent: () => mounted.current && location.pathname + location.search === path,
        hasDurablePending: () => {
          const outbox = input.services.outbox;
          const command = input.actions.getPendingCommand();
          return Boolean(
            outbox &&
              (command
                ? outbox.isPersisted(command)
                : outbox.hasPersistedPending({
                    unitId: input.asset.unit.id,
                    contentVersion: input.asset.contentVersion,
                  })),
          );
        },
        save: () => input.actions.saveFinal(input.position, input.catalogHref),
        leave: () => input.go(input.catalogHref),
      }),
    previous: () => {
      if (!previousHref || input.blocked) return;
      if (final) return input.actions.saveFinal(Math.max(input.position - 1, 0), previousHref);
      input.go(previousHref);
    },
  };
}
