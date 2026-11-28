import { useEffect, useState } from 'react';
import {
  type AppliedSlideRecord,
  canStoreAppliedSlides,
  readAppliedSlide,
  storeAppliedSlide,
} from './slideRecord';

export function useAppliedSlideRecord(
  key: string,
  steps: readonly string[],
  reflectionStep: string | undefined,
  accountId?: string,
  requestedStep?: string,
) {
  const [record, setRecord] = useState(() => {
    const saved = readAppliedSlide(key, steps, reflectionStep, canStoreAppliedSlides(accountId));
    return requestedStep && steps.includes(requestedStep) ? { ...saved, stepId: requestedStep } : saved;
  });
  const [failed, setFailed] = useState(false);

  function store(next: AppliedSlideRecord) {
    setRecord(next);
    setFailed(canStoreAppliedSlides(accountId) && !storeAppliedSlide(key, next));
  }

  function apply(patch: Partial<AppliedSlideRecord>) {
    const latest = readAppliedSlide(key, steps, reflectionStep, canStoreAppliedSlides(accountId));
    store({ ...record, reflection: latest.reflection ?? record.reflection, ...patch });
  }

  useEffect(() => {
    function clear(event: StorageEvent) {
      if (event.newValue === null && (event.key === key || event.key === null)) {
        setRecord({ stepId: steps[0] });
        setFailed(false);
      }
    }
    window.addEventListener('storage', clear);
    return () => window.removeEventListener('storage', clear);
  }, [key, steps]);

  function consentChanged() {
    if (!canStoreAppliedSlides(accountId)) {
      setFailed(false);
      return;
    }
    const saved = readAppliedSlide(key, steps, reflectionStep, true);
    if (record.stepId !== steps[0] || record.reflection)
      store({ ...record, reflection: record.reflection ?? saved.reflection });
    else setRecord(saved);
  }

  return { record, apply, store, failed, consentChanged };
}
