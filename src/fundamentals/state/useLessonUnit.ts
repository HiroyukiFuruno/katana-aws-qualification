import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../locales';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import { guestLessonPrefix } from './guestStorage';
import type { LessonServices } from './services';
import type { LessonSnapshot } from './types';

export type Loaded = {
  asset: DeliveryUnitAsset;
  snapshot: LessonSnapshot;
  services: LessonServices;
  version: number;
};

type AssetScope = {
  contentVersion?: string;
  services: LessonServices;
  unitId: string;
  version: number;
};

export function replaceLoadedAsset(
  current: Loaded | undefined,
  asset: DeliveryUnitAsset,
  scope: AssetScope,
): Loaded | undefined {
  if (
    !current ||
    current.services !== scope.services ||
    current.asset.unit.id !== scope.unitId ||
    asset.unit.id !== scope.unitId ||
    current.version !== scope.version ||
    current.asset.contentVersion !== asset.contentVersion ||
    (scope.contentVersion !== undefined && current.asset.contentVersion !== scope.contentVersion)
  )
    return current;
  return { ...current, asset };
}

export function useLessonUnit(
  services: LessonServices | null,
  unitId: string,
  locale: Locale,
  contentVersion?: string,
) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [asset, setAsset] = useState<DeliveryUnitAsset>();
  const [error, setError] = useState<unknown>();
  const [version, setVersion] = useState(0);
  const [assetRequest, setAssetRequest] = useState(0);
  const latest = useRef<Loaded | undefined>(undefined);
  const latestAssetRequest = useRef(assetRequest);
  latest.current = loaded;
  latestAssetRequest.current = assetRequest;
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
    const request = assetRequest;
    const retained = latest.current;
    const keepSnapshot =
      retained?.services === services &&
      retained.asset.unit.id === unitId &&
      retained.version === version &&
      (contentVersion === undefined || retained.asset.contentVersion === contentVersion);
    setError(undefined);
    if (!keepSnapshot) {
      setLoaded(undefined);
      setAsset(undefined);
    }
    if (services) {
      void services.assets
        .unit(unitId, contentVersion, locale)
        .then(async (asset) => {
          if (!current || latestAssetRequest.current !== request) return;
          setAsset(asset);
          if (
            keepSnapshot &&
            retained?.asset.unit.id === asset.unit.id &&
            retained.asset.contentVersion === asset.contentVersion
          ) {
            setLoaded((current) =>
              replaceLoadedAsset(current, asset, { services, unitId, version, contentVersion }),
            );
            return;
          }
          const snapshot = await services.load(asset);
          if (current && latestAssetRequest.current === request)
            setLoaded({ asset, snapshot, services, version });
        })
        .catch((cause: unknown) => {
          if (current && latestAssetRequest.current === request) setError(cause);
        });
    }
    return () => {
      current = false;
    };
  }, [services, unitId, locale, version, contentVersion, assetRequest]);
  return {
    loaded:
      loaded?.services === services && loaded.asset.unit.id === unitId && loaded.version === version
        ? loaded
        : undefined,
    error,
    asset: asset?.unit.id === unitId ? asset : undefined,
    reload: () => setVersion((current) => current + 1),
    retry: () => setAssetRequest((current) => current + 1),
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
