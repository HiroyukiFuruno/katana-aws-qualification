import { useEffect, useState } from 'react';
import { usePreferences } from '../../preferences';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonRoute } from '../delivery/navigation';
import { reachableLessonHref, resumeLessonHref, routedLessonStep } from '../delivery/planNavigation';
import { navigateLesson } from '../delivery/useLessonLocation';
import type { LessonServices } from '../state/services';
import type { LessonSnapshot } from '../state/types';
import { LessonResultControl } from './LessonResultControl';
import { LessonStepScreen } from './LessonStepScreen';

type Props = {
  services: LessonServices;
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  route: LessonRoute;
  update: (snapshot: LessonSnapshot) => void;
};

function viewFor(route: LessonRoute, asset: DeliveryUnitAsset, snapshot: LessonSnapshot) {
  try {
    return {
      redirect: reachableLessonHref(route, asset, snapshot),
      step: routedLessonStep(route, asset),
    };
  } catch (error) {
    return { error };
  }
}

export function LessonLoaded({ services, asset, snapshot, route, update }: Props) {
  const { t } = usePreferences();
  const [reloadVersion, setReloadVersion] = useState(0);
  const view = viewFor(route, asset, snapshot);
  useEffect(() => {
    if (view.redirect) navigateLesson(view.redirect, true);
  }, [view.redirect]);
  const path = location.pathname + location.search;
  const confirm = (result: LessonSnapshot, href?: string) => {
    update(result);
    if (href && location.pathname + location.search === path) navigateLesson(href);
  };
  const reloadSaved = async () => {
    const refreshed = await services.loadSaved(asset);
    update(refreshed);
    if (location.pathname + location.search !== path) return;
    setReloadVersion((version) => version + 1);
    if (refreshed.progress.activeFinalSessionId !== snapshot.progress.activeFinalSessionId) {
      navigateLesson(resumeLessonHref(route.locale, asset, refreshed, route.contentVersion), true);
    }
  };
  if (view.error)
    return (
      <main id="main" className="shell">
        <p role="alert">{t('fundamentalsLoadError')}</p>
      </main>
    );
  if (view.redirect)
    return (
      <main id="main" className="shell">
        <p role="status">{t('fundamentalsLoading')}</p>
      </main>
    );
  if (route.stage === 'result') {
    return (
      <LessonResultControl
        asset={asset}
        snapshot={snapshot}
        services={services}
        confirm={confirm}
        reloadSaved={reloadSaved}
        contentVersion={route.contentVersion}
      />
    );
  }
  if (!view.step) return null;
  return (
    <LessonStepScreen
      key={`${view.step.id}:${snapshot.progress.activeFinalSessionId ?? ''}:${reloadVersion}`}
      asset={asset}
      snapshot={snapshot}
      services={services}
      step={view.step}
      route={route}
      confirm={confirm}
      reloadSaved={reloadSaved}
      commit={update}
    />
  );
}
