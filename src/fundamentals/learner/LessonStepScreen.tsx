import { useState } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import { SiteAd, SiteAdLayout } from '../../SiteAd';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonReadingCopy } from '../delivery/lessonReadingCopy';
import type { LessonRoute } from '../delivery/navigation';
import type { LessonStep } from '../delivery/slideTypes';
import { isLessonConflict } from '../state/isLessonConflict';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { useLessonRecovery } from '../state/useLessonRecovery';
import { useSavedLessonReload } from '../state/useSavedLessonReload';
import { LessonConflictRetry } from './LessonConflictRetry';
import { LessonSlideShell } from './LessonSlideShell';
import { LessonStepContent } from './LessonStepContent';
import { stepQuestionPresentation } from './lesson-presentation';
import { useLessonNavigation } from './lessonNavigation';
import { lessonSlidePresentation } from './lessonSlidePresentation';
import { useCheckpointPresentation } from './useCheckpointPresentation';
import { useLessonActions } from './useLessonActions';

type Props = {
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  services: LessonServices;
  step: LessonStep;
  route: LessonRoute;
  confirm: (snapshot: LessonSnapshot, href?: string) => void;
  reloadSaved: () => Promise<void>;
  commit: (snapshot: LessonSnapshot) => void;
};
export function LessonStepScreen({
  asset,
  snapshot,
  services,
  step,
  route,
  confirm,
  reloadSaved,
  commit,
}: Props) {
  const { locale, t } = usePreferences();
  const slide = lessonSlidePresentation(asset.steps, step);
  const displayStep = lessonReadingCopy(slide.display, locale);
  const { activeFinalSessionId } = snapshot.progress;
  const active = snapshot.sessions.find((session) => session.sessionId === activeFinalSessionId);
  const presentationPosition = route.stage === 'final' && route.position ? route.position - 1 : -1;
  const session = active?.sessionId;
  const questionPresentation = stepQuestionPresentation(asset, step, session, presentationPosition);
  const { presentedFinal, question } = questionPresentation;
  const [selected, setSelected] = useState<string[]>(
    active?.responses[String(presentedFinal?.canonicalPosition ?? -1)]?.selected ?? [],
  );
  const [feedback, setFeedback] = useState(false);
  const checkpoint = useCheckpointPresentation(question, step.kind === 'checkpoint');
  const [actionError, setActionError] = useState<unknown>();
  const recovery = useLessonRecovery(services, asset, commit);
  const actions = useLessonActions({
    services,
    asset,
    snapshot,
    step,
    lastPosition: slide.lastPosition,
    locale,
    contentVersion: route.contentVersion,
    finalPosition: presentedFinal?.canonicalPosition,
    presentationPosition,
    selected,
    commit,
    confirm: (result, href) => {
      if (!href && result.checkpointResult) setFeedback(true);
      confirm(result, href);
    },
  });
  const savedReload = useSavedLessonReload(actions.discard, reloadSaved, recovery.clear);
  const catalogHref = localePath(locale, 'study/fundamentals');
  const blocked =
    [actions, recovery, savedReload].some(({ busy, error }) => busy || error) || actions.pending;
  const saveError = actions.error || recovery.error;
  const conflict = isLessonConflict(saveError);
  const navigation = useLessonNavigation({
    asset,
    services,
    actions,
    step,
    previousStep: slide.previous,
    active: Boolean(active),
    question,
    selectedCount: selected.length,
    feedback,
    position: presentationPosition,
    locale,
    contentVersion: route.contentVersion,
    catalogHref,
    blocked,
    saving: actions.busy || recovery.busy || savedReload.busy,
    go: (href) => confirm(snapshot, href),
  });
  return (
    <SiteAdLayout show viewKey={step.id}>
      <LessonSlideShell
        step={displayStep}
        unitTitle={asset.unit.title}
        catalogHref={catalogHref}
        adSlot={<SiteAd placement="inline" />}
        onCatalog={navigation.catalog}
        previousHref={navigation.previousHref}
        onPrevious={navigation.previous}
        saving={navigation.saving}
        error={saveError || actionError || savedReload.error ? t('progressCloudSaveFailed') : undefined}
        onRetry={
          savedReload.error
            ? savedReload.retry
            : conflict
              ? undefined
              : recovery.error
                ? recovery.retry
                : actions.retry
        }
        onActionError={setActionError}
        onNext={navigation.nextAllowed ? actions.next : undefined}
        nextLabel={navigation.nextLabelKey ? t(navigation.nextLabelKey, { total: 12 }) : undefined}
      >
        {conflict ? (
          <LessonConflictRetry
            busy={actions.busy || savedReload.busy}
            label={t('examReloadSaved')}
            retry={() => void savedReload.retry()}
          />
        ) : null}
        <LessonStepContent
          asset={asset}
          step={displayStep}
          optionalObjectives={slide.optionalObjectives.map((item) => lessonReadingCopy(item, locale))}
          question={checkpoint.question}
          selected={selected}
          onChange={setSelected}
          activeFinal={Boolean(active)}
          requiredScore={asset.finalPolicy.passCorrect}
          blocked={blocked}
          feedback={feedback}
          checkpoint={actions.checkpoint}
          retryCheckpoint={() => {
            setFeedback(false);
            checkpoint.reshuffle();
          }}
        />
      </LessonSlideShell>
    </SiteAdLayout>
  );
}
