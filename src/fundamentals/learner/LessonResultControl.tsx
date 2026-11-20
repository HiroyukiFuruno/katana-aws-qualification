import { useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { lessonPath } from '../delivery/navigation';
import { isLessonConflict } from '../state/isLessonConflict';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { useLessonMutation } from '../state/useLessonMutation';
import { useLessonRecovery } from '../state/useLessonRecovery';
import { useSavedLessonReload } from '../state/useSavedLessonReload';
import { LessonResult } from './LessonResult';
import { submittedSession } from './lesson-result-helpers';

type Props = {
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  services: LessonServices;
  confirm: (snapshot: LessonSnapshot, href?: string) => void;
  reloadSaved: () => Promise<void>;
  contentVersion?: string;
};

export function LessonResultControl({
  asset,
  snapshot,
  services,
  confirm,
  reloadSaved,
  contentVersion,
}: Props) {
  const { locale, t } = usePreferences();
  const [sessionId] = useState(() => submittedSession(snapshot.sessions)?.sessionId);
  const mutation = useLessonMutation(services, asset, (result) => confirm(result));
  const recovery = useLessonRecovery(services, asset, (result) => confirm(result));
  const savedReload = useSavedLessonReload(mutation.discard, reloadSaved, recovery.clear);
  const failure = mutation.error || recovery.error;
  const conflict = isLessonConflict(failure);
  const retry = async () => {
    if (savedReload.error) return savedReload.retry();
    if (recovery.error) return recovery.retry();
    if (mutation.pending) return mutation.retry();
    const active = snapshot.sessions.find(
      (session) => session.sessionId === snapshot.progress.activeFinalSessionId,
    );
    if (active) {
      confirm(
        snapshot,
        lessonPath({
          locale,
          unitId: asset.unit.id,
          stage: 'final',
          position: active.position + 1,
          contentVersion,
        }),
      );
      return;
    }
    await mutation.execute(
      {
        kind: 'startFinal',
        commandId: crypto.randomUUID(),
        unitId: asset.unit.id,
        contentVersion: asset.contentVersion,
        input: { sessionId: crypto.randomUUID(), expectedRevision: snapshot.progress.revision },
      },
      (result) =>
        confirm(
          result,
          lessonPath({ locale, unitId: asset.unit.id, stage: 'final', position: 1, contentVersion }),
        ),
    );
  };
  return (
    <LessonResult
      asset={asset}
      snapshot={snapshot}
      sessionId={sessionId}
      contentVersion={contentVersion}
      onRetry={retry}
      onNavigate={(href) => {
        if (!mutation.busy && !recovery.busy && !savedReload.busy) confirm(snapshot, href);
      }}
      busy={mutation.busy || recovery.busy || savedReload.busy}
      error={failure || savedReload.error ? t('progressCloudSaveFailed') : undefined}
      onReloadSaved={conflict ? savedReload.retry : undefined}
    />
  );
}
