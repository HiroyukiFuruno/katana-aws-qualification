import { useMemo } from 'react';
import type { SiteContent } from '../contentTypes';
import { usePreferences } from '../preferences';
import { useContent } from '../useContent';
import type { DashboardLessonData } from './viewTypes';

type Translator = ReturnType<typeof usePreferences>['t'];

export type DashboardDisplayLabels = {
  certification: (value: string) => string;
  category: (value: string) => string;
  sourceVersion: (value: string) => string;
  revision: (sourceVersion: string, questionRevision: number) => string;
};

export function createDashboardDisplayLabels(
  content: SiteContent,
  t: Translator,
  lessons: readonly DashboardLessonData[],
): DashboardDisplayLabels {
  const lessonTitles = new Map(lessons.map((lesson) => [lesson.unitId, lesson.title]));
  const known = (value: string) => content.labels[value] ?? t('unavailableDomain');
  return {
    certification: (value) =>
      value === 'fundamentals'
        ? t('learnFundamentals')
        : (content.certifications[value]?.name ?? t('unavailableDomain')),
    category: (value) => lessonTitles.get(value) ?? known(value),
    sourceVersion: known,
    revision: (sourceVersion, questionRevision) =>
      t('dashboardRevisionLabel', { sourceVersion: known(sourceVersion), revision: questionRevision }),
  };
}

export function useDashboardDisplayLabels(lessons: readonly DashboardLessonData[] = []) {
  const { content } = useContent();
  const { t } = usePreferences();
  return useMemo(() => createDashboardDisplayLabels(content, t, lessons), [content, lessons, t]);
}
