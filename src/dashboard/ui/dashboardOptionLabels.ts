import type { usePreferences } from '../../preferences';
import { certificationLabel } from './dashboardFilterOptions';

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
    return t('dashboardRevisionLabel', {
      sourceVersion: revision.sourceVersion,
      revision: revision.questionRevision,
    });
  }
  const label = labels[`${key}:${value}`];
  return label ? t(label) : value;
}
