import { useEffect, useState } from 'react';
import { guestLessonPrefix } from '../../learningStorage';
import { usePreferences } from '../../preferences';
import { canPersistGuestProgress } from '../../progress/guest';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonMigrationAccess } from '../state/importTypes';
import type { LessonServices } from '../state/services';
import { LessonMigrationPrompt } from './LessonMigrationPrompt';

type Props = {
  services: LessonServices;
  access: () => LessonMigrationAccess | null;
  onImported: () => void;
};

export function LessonMigrationList({ services, access, onImported }: Props) {
  const { t } = usePreferences();
  const [units, setUnits] = useState<DeliveryUnitAsset[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    const member = access();
    setUnits([]);
    setFailed(false);
    if (!member || !canPersistGuestProgress(localStorage)) return;
    void services.assets
      .index()
      .then(async (index) => {
        const pending = new Set<string>();
        for (let offset = 0; offset < localStorage.length; offset++) {
          const key = localStorage.key(offset);
          if (key?.startsWith(guestLessonPrefix)) pending.add(key);
        }
        const assets: DeliveryUnitAsset[] = [];
        for (const entry of index.units) {
          const key = `${guestLessonPrefix}${entry.unitId}.${entry.contentVersion}`;
          if (pending.delete(key))
            assets.push(await services.assets.unit(entry.unitId, entry.contentVersion));
        }
        if (current && access()?.owner.userId === member.owner.userId) {
          setUnits(assets);
          setFailed(pending.size > 0);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [services, access]);
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
