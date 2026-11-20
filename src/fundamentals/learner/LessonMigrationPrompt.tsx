import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePreferences } from '../../preferences';
import type { BrowserStorage } from '../../progress/guest';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { importGuestLesson, readGuestLessonImport } from '../state/importGuestLesson';
import type { LessonMigrationAccess } from '../state/importTypes';

type Props = {
  access: () => LessonMigrationAccess | null;
  asset: DeliveryUnitAsset;
  onImported?: () => void | Promise<void>;
  storage?: BrowserStorage;
};

const browserStorage: BrowserStorage = {
  getItem: (key) => localStorage.getItem(key),
  removeItem: (key) => localStorage.removeItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

export function LessonMigrationPrompt({ access, asset, onImported, storage = browserStorage }: Props) {
  const { t } = usePreferences();
  const headingId = useId();
  const [state, setState] = useState<'failed' | 'idle' | 'importing' | 'success'>('idle');
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const available = useMemo(() => {
    const member = access();
    if (!member) return false;
    try {
      return readGuestLessonImport({ access: member, asset, storage }) !== null;
    } catch {
      return true;
    }
  }, [access, asset, storage]);
  if (!available || state === 'success') return null;
  async function migrate() {
    const member = access();
    if (!member) return setState('failed');
    setState('importing');
    try {
      const result = await importGuestLesson({ access: member, asset, storage });
      if (!mounted.current || !member.isCurrent()) return;
      if (!result.removed) return setState('failed');
      await onImported?.();
      if (!mounted.current || !member.isCurrent()) return;
      setState('success');
    } catch {
      if (mounted.current) setState('failed');
    }
  }
  return (
    <section className="notice" aria-labelledby={headingId}>
      <h2 id={headingId}>
        {t('progressMigrationTitle')} · {asset.unit.title}
      </h2>
      <p>{t('progressMigrationDescription', { count: 1 })}</p>
      {state === 'failed' && <p role="alert">{t('progressMigrationFailed')}</p>}
      <button type="button" disabled={state === 'importing'} onClick={() => void migrate()}>
        {state === 'importing' ? t('progressAuthLoading') : t('progressMigrationStart')}
      </button>
    </section>
  );
}
