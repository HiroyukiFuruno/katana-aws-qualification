import type { usePreferences } from '../../preferences';

type Translator = ReturnType<typeof usePreferences>['t'];
const keys: Record<string, Parameters<Translator>[0]> = {
  study: 'study',
  review: 'review',
  exam: 'exam',
  practice: 'dashboardContextPractice',
  'lesson-checkpoint': 'dashboardContextCheckpoint',
  'lesson-final': 'dashboardContextFinal',
  'choice-single': 'dashboardFormatSingle',
  'choice-multiple': 'dashboardFormatMultiple',
  ordering: 'dashboardFormatOrdering',
  matching: 'dashboardFormatMatching',
  unknown: 'dashboardFormatUnknown',
  correct: 'dashboardPolarityCorrect',
  incorrect: 'dashboardPolarityIncorrect',
  unspecified: 'dashboardPolarityUnspecified',
};
export function dashboardDimensionLabel(value: string, t: Translator) {
  return Object.hasOwn(keys, value) ? t(keys[value]) : value;
}
