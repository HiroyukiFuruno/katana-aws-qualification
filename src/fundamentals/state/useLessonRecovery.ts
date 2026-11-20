import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonServices } from './services';
import type { LessonSnapshot } from './types';

type Confirm = (snapshot: LessonSnapshot) => void | Promise<void>;

export function useLessonRecovery(
  services: LessonServices,
  asset: DeliveryUnitAsset,
  onConfirmed: Confirm,
) {
  const initiallyPending = useRef(Boolean(services.outbox?.hasPending()));
  const [busy, setBusy] = useState(initiallyPending.current);
  const [error, setError] = useState<unknown>();
  const mounted = useRef(true);
  const started = useRef(false);
  const assetRef = useRef(asset);
  const servicesRef = useRef(services);
  const confirmedRef = useRef(onConfirmed);
  assetRef.current = asset;
  servicesRef.current = services;
  confirmedRef.current = onConfirmed;
  const recover = useCallback(async () => {
    const active = servicesRef.current;
    if (mounted.current) {
      setBusy(true);
      setError(undefined);
    }
    try {
      const snapshot = await active.load(assetRef.current);
      if (servicesRef.current !== active) return;
      await confirmedRef.current(snapshot);
      if (!mounted.current || servicesRef.current !== active) return;
    } catch (cause) {
      if (mounted.current && servicesRef.current === active) setError(cause);
    } finally {
      if (mounted.current && servicesRef.current === active) setBusy(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      if (initiallyPending.current) void recover();
    }
    return () => {
      mounted.current = false;
    };
  }, [recover]);
  return {
    busy,
    error,
    retry: recover,
    clear: () => {
      if (mounted.current) setError(undefined);
    },
  };
}
