import { useState } from 'react';
import { localePath } from '../../locales';
import { usePreferences } from '../../preferences';
import type { LessonRoute } from '../delivery/navigation';
import { GuestLessonConflictError } from '../state/guestStorage';
import type { LessonServices } from '../state/services';
import { useLessonUnit } from '../state/useLessonUnit';
import { LessonLoaded } from './LessonLoaded';

export function LessonUnit({ services, route }: { services: LessonServices; route: LessonRoute }) {
  const { locale, t } = usePreferences();
  const unit = useLessonUnit(services, route.unitId, locale, route.contentVersion);
  const [actionError, setActionError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function resolve(choice: 'pending' | 'stored') {
    if (!unit.asset || !services.guest || busy) return;
    setBusy(true);
    setActionError(undefined);
    try {
      await services.guest.resolve(unit.asset, choice);
      unit.reload();
    } catch (cause) {
      setActionError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function saved() {
    if (!unit.asset || busy) return;
    setBusy(true);
    try {
      await services.loadSaved(unit.asset);
      unit.reload();
    } catch (cause) {
      setActionError(cause);
    } finally {
      setBusy(false);
    }
  }
  if (unit.loaded) {
    return <LessonLoaded {...unit.loaded} route={route} update={unit.update} />;
  }
  const error = unit.error || actionError;
  const conflict = unit.error instanceof GuestLessonConflictError;
  const stale =
    unit.error && typeof unit.error === 'object' && 'code' in unit.error && unit.error.code === 'PT412';
  return (
    <main id="main" className="shell" aria-busy={busy || !error}>
      <p role={error ? 'alert' : 'status'}>
        {t(
          conflict
            ? 'progressStorageConflictDescription'
            : error
              ? 'fundamentalsLoadError'
              : 'fundamentalsLoading',
        )}
      </p>
      {conflict ? (
        <>
          <p>{t('progressStorageConflictChoiceDescription')}</p>
          <button type="button" disabled={busy} onClick={() => void resolve('stored')}>
            {t('progressStorageConflictUseStored')}
          </button>
          <button type="button" disabled={busy} onClick={() => void resolve('pending')}>
            {t('progressStorageConflictUseCurrent')}
          </button>
        </>
      ) : stale ? (
        <button type="button" disabled={busy} onClick={() => void saved()}>
          {t('examReloadSaved')}
        </button>
      ) : error ? (
        <button type="button" onClick={unit.reload}>
          {t('fundamentalsReload')}
        </button>
      ) : null}
      <a href={localePath(locale, 'study/fundamentals')}>{t('lessonExit')}</a>
    </main>
  );
}
