import { useEffect, useState } from 'react';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { guestLessonPrefix } from './guestStorage';
import type { LessonServices } from './services';
import type { LessonSnapshot } from './types';

type Loaded = {
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  services: LessonServices;
  version: number;
};

export function useLessonUnit(services: LessonServices | null, unitId: string) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [asset, setAsset] = useState<DeliveryUnitAsset>();
  const [error, setError] = useState<unknown>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const guest = services?.guest;
    if (!guest) return;
    const refresh = () => setVersion((version) => version + 1);
    const unsubscribe = guest.subscribe(refresh);
    const changed = (event: StorageEvent) => {
      if (event.key === null) guest.clearMemory();
      else if (event.key.startsWith(`${guestLessonPrefix}${unitId}.`)) {
        if (event.newValue === null) guest.clearMemory(event.key);
        // 実行中の設問順と未確定の選択を保ち、保存時に最新の原本へ照合する。
      }
    };
    window.addEventListener('storage', changed);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', changed);
    };
  }, [services, unitId]);
  useEffect(() => {
    let current = true;
    setError(undefined);
    setLoaded(undefined);
    setAsset(undefined);
    if (services) {
      void services.assets
        .unit(unitId)
        .then(async (asset) => {
          if (current) setAsset(asset);
          return { asset, snapshot: await services.load(asset), services, version };
        })
        .then((result) => {
          if (current) setLoaded(result);
        })
        .catch((cause: unknown) => {
          if (current) setError(cause);
        });
    }
    return () => {
      current = false;
    };
  }, [services, unitId, version]);
  return {
    loaded:
      loaded?.services === services && loaded.asset.unit.id === unitId && loaded.version === version
        ? loaded
        : undefined,
    error,
    asset: asset?.unit.id === unitId ? asset : undefined,
    reload: () => setVersion((current) => current + 1),
    update: (snapshot: LessonSnapshot) =>
      setLoaded((current) =>
        current?.services === services &&
        current.version === version &&
        current.asset.unit.id === unitId &&
        snapshot.unitId === unitId &&
        snapshot.contentVersion === current.asset.contentVersion
          ? { ...current, snapshot }
          : current,
      ),
  };
}
