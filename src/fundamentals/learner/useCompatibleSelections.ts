import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import type { Message } from '../../messages';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import type { LessonServices } from '../state/services';

type LoadedSelections = {
  asset: DeliveryUnitAsset;
  services: LessonServices;
  selections: Readonly<Record<string, readonly string[]>>;
};

type RetryState = {
  error: unknown;
  retry: () => Promise<void>;
};

function recoveredSelection(
  question: DeliveryQuestion | undefined,
  selections: Readonly<Record<string, readonly string[]>> | undefined,
  selected: readonly string[],
  selectedByLearner: boolean,
) {
  const recovered = question && selections?.[question.id];
  if (
    !question ||
    !recovered ||
    selectedByLearner ||
    selected.length > 0 ||
    recovered.length !== question.requiredChoices ||
    recovered.some((id) => !question.choices.some((choice) => choice.id === id))
  )
    return;
  return [...recovered];
}

export function useCompatibleSelections(services: LessonServices, asset: DeliveryUnitAsset) {
  const [loaded, setLoaded] = useState<LoadedSelections>();
  const [failed, setFailed] = useState<Pick<LoadedSelections, 'asset' | 'services'>>();
  useEffect(() => {
    let current = true;
    setLoaded(undefined);
    setFailed(undefined);
    void services.compatibleSelections(asset).then(
      (selections) => {
        if (current) setLoaded({ asset, services, selections });
      },
      () => {
        if (current) setFailed({ asset, services });
      },
    );
    return () => {
      current = false;
    };
  }, [services, asset]);
  return {
    failed: failed?.asset === asset && failed.services === services,
    selections: loaded?.asset === asset && loaded.services === services ? loaded.selections : undefined,
  };
}

export function lessonSaveRetry(
  savedReload: RetryState,
  recovery: RetryState,
  actionRetry: () => Promise<void>,
  conflict: boolean,
) {
  if (savedReload.error) return savedReload.retry;
  if (conflict) return undefined;
  return recovery.error ? recovery.retry : actionRetry;
}

export function useRecoveredCompatibleSelection(
  question: DeliveryQuestion | undefined,
  selections: Readonly<Record<string, readonly string[]>> | undefined,
  selected: readonly string[],
  setSelected: Dispatch<SetStateAction<string[]>>,
  failed: boolean,
) {
  const selectedByLearner = useRef(false);
  const [recovered, setRecovered] = useState(false);
  const selection = recoveredSelection(question, selections, selected, selectedByLearner.current);
  useEffect(() => {
    if (!selection || selectedByLearner.current) return;
    setSelected(selection);
    setRecovered(true);
  }, [selection, setSelected]);
  const message: Message | undefined = recovered
    ? 'fundamentalsRecoveredSelection'
    : failed
      ? 'fundamentalsHistoryUnavailable'
      : undefined;
  return {
    message,
    select(next: string[]) {
      selectedByLearner.current = true;
      setRecovered(false);
      setSelected(next);
    },
  };
}
