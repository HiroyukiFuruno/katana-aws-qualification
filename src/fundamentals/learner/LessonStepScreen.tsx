import { useState } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import { SiteAd, SiteAdLayout } from '../../SiteAd';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonRoute } from '../delivery/navigation';
import type { LessonStep } from '../delivery/slideTypes';
import { isLessonConflict } from '../state/isLessonConflict';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { useLessonRecovery } from '../state/useLessonRecovery';
import { useSavedLessonReload } from '../state/useSavedLessonReload';
import { LessonSlideShell } from './LessonSlideShell';
import { LessonStepContent } from './LessonStepContent';
import { useLessonActions } from './useLessonActions';
import { useLessonNavigation } from './lessonNavigation';

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
  const showAd = step.kind !== 'final';
  const active = snapshot.sessions.find(
    (session) => session.sessionId === snapshot.progress.activeFinalSessionId,
  );
  const position = route.stage === 'final' && route.position ? route.position - 1 : -1;
  const question =
    step.kind === 'final'
      ? asset.finalQuestions[position]
      : asset.checkpoints.find((item) => item.id === step.assessmentId);
  const [selected, setSelected] = useState<string[]>(
    active?.responses[String(position)]?.selected ?? [],
  );
  const [feedback, setFeedback] = useState(false);
  const [actionError, setActionError] = useState<unknown>();
  const recovery = useLessonRecovery(services, asset, commit);
  const actions = useLessonActions({
    services,
    asset,
    snapshot,
    step,
    locale,
    contentVersion: route.contentVersion,
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
    actions.busy ||
    actions.pending ||
    recovery.busy ||
    savedReload.busy ||
    Boolean(recovery.error || savedReload.error);
  const saveError = actions.error || recovery.error;
  const conflict = isLessonConflict(saveError);
  const go = (href: string) => confirm(snapshot, href);
  const navigation = useLessonNavigation({
    asset,
    services,
    actions,
    step,
    active: Boolean(active),
    question,
    selectedCount: selected.length,
    feedback,
    position,
    locale,
    contentVersion: route.contentVersion,
    catalogHref,
    blocked,
    saving: actions.busy || recovery.busy || savedReload.busy,
    go,
  });
  return (
    <SiteAdLayout show={showAd} viewKey={step.id}>
      <LessonSlideShell
        step={step}
        unitTitle={asset.unit.title}
        catalogHref={catalogHref}
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
        adSlot={showAd && <SiteAd key={step.id} placement="inline" />}
      >
        {conflict ? (
          <button
            type="button"
            disabled={actions.busy || savedReload.busy}
            onClick={() => void savedReload.retry()}
          >
            {t('examReloadSaved')}
          </button>
        ) : null}
        <LessonStepContent
          asset={asset}
          step={step}
          question={question}
          selected={selected}
          onChange={setSelected}
          activeFinal={Boolean(active)}
          requiredScore={asset.finalPolicy.passCorrect}
          blocked={blocked}
          feedback={feedback}
          checkpoint={actions.checkpoint}
          retryCheckpoint={() => setFeedback(false)}
        />
      </LessonSlideShell>
    </SiteAdLayout>
  );
}
