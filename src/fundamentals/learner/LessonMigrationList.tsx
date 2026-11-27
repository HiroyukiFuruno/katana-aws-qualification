import { useEffect, useState } from 'react';
import { usePreferences } from '../../preferences';
import { canPersistGuestProgress } from '../../progress/guest';
import type { LessonRecordAsset } from '../delivery/recordAsset';
import { guestLessonKeys, guestLessonReference } from '../state/guestReferences';
import type { LessonMigrationAccess } from '../state/importTypes';
import type { LessonServices } from '../state/services';
import { LessonMigrationPrompt } from './LessonMigrationPrompt';

type Props = {
  services: LessonServices;
  access: () => LessonMigrationAccess | null;
  onImported: () => void;
};

export function LessonMigrationList({ services, access, onImported }: Props) {
  const { locale, t } = usePreferences();
  const [units, setUnits] = useState<LessonRecordAsset[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    const member = access();
    setUnits([]);
    setFailed(false);
    if (!member || !canPersistGuestProgress(localStorage)) return;
    void services.assets
      .index(locale)
      .then(async (index) => {
        const titles = new Map(index.units.map(({ unitId, title }) => [unitId, title]));
        const pending = await Promise.allSettled(
          guestLessonKeys(localStorage).map(async (key) => {
            const reference = guestLessonReference(key);
            if (!reference) return undefined;
            const { unitId, contentVersion } = reference;
            return services.assets.record(unitId, contentVersion, locale, localStorage);
          }),
        );
        if (current && access()?.owner.userId === member.owner.userId) {
          const assets = pending.flatMap((result) => {
            if (result.status !== 'fulfilled' || !result.value) return [];
            const { unit } = result.value;
            return [{ ...result.value, unit: { ...unit, title: titles.get(unit.id) ?? unit.title } }];
          });
          setUnits(assets);
          setFailed(pending.length !== assets.length);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [services, access, locale]);
  return (
    <>
      {failed && <p role="alert">{t('progressMigrationFailed')}</p>}
      {units.map((asset) => (
        <LessonMigrationPrompt
          key={`${asset.unit.id}:${asset.contentVersion}`}
          asset={asset}
          access={access}
          onImported={onImported}
        />
      ))}
    </>
  );
}
