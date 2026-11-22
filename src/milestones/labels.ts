import { usePreferences } from '../preferences';
import type { MilestoneLabels } from './presentationTypes';
import type { MilestoneKind } from './types';

export function useMilestoneLabels(): MilestoneLabels & { t: ReturnType<typeof usePreferences>['t'] } {
  const { t } = usePreferences();
  return {
    t,
    title: t('milestoneTitleLabel'),
    date: t('milestoneDate'),
    completed: t('milestoneCompleted'),
    target: t('milestoneKindTarget'),
    study: t('milestoneKindStudy'),
    mock_exam: t('milestoneKindMockExam'),
    exam: t('milestoneKindExam'),
  } as MilestoneLabels & { t: typeof t };
}

export const kindKeys: readonly MilestoneKind[] = ['target', 'study', 'mock_exam', 'exam'];
