import type { Message } from '../../messages';
import type { usePreferences } from '../../preferences';
import type { DashboardFilters } from '../queryTypes';
import { certificationLabel } from './dashboardFilterOptions';

export const dashboardPeriodKeys = {
  '7d': 'dashboard7d',
  '30d': 'dashboard30d',
  '90d': 'dashboard90d',
  all: 'dashboardAllTime',
} as const satisfies Record<DashboardFilters['period'], Message>;

type Translator = ReturnType<typeof usePreferences>['t'];
const labels: Record<string, Parameters<Translator>[0]> = {
  'modes:study': 'study',
  'modes:review': 'review',
  'modes:exam': 'exam',
  'contexts:practice': 'dashboardContextPractice',
  'contexts:exam': 'dashboardContextExam',
  'contexts:lesson-checkpoint': 'dashboardContextCheckpoint',
  'contexts:lesson-final': 'dashboardContextFinal',
  'formats:choice-single': 'dashboardFormatSingle',
  'formats:choice-multiple': 'dashboardFormatMultiple',
  'formats:ordering': 'dashboardFormatOrdering',
  'formats:matching': 'dashboardFormatMatching',
  'formats:unknown': 'dashboardFormatUnknown',
  'polarities:correct': 'dashboardPolarityCorrect',
  'polarities:incorrect': 'dashboardPolarityIncorrect',
  'polarities:unspecified': 'dashboardPolarityUnspecified',
};
export function dashboardOptionLabel(key: string, value: string, t: Translator) {
  if (key === 'certificationIds') return certificationLabel(value);
  if (key === 'revisions') {
    const revision = JSON.parse(value) as { sourceVersion: string; questionRevision: number };
    return `${revision.sourceVersion} / r${revision.questionRevision}`;
  }
  const label = labels[`${key}:${value}`];
  return label ? t(label) : value;
}
