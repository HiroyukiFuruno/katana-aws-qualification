import type { AssessmentItem } from './assessmentTypes';

export function localizeAssessment(canonical: AssessmentItem[], localized: AssessmentItem[]) {
  const byId = new Map(localized.map((item) => [item.id, item]));
  if (
    canonical.length !== localized.length ||
    canonical.some((item) => {
      const translated = byId.get(item.id);
      return (
        !translated ||
        translated.skill !== item.skill ||
        translated.correct !== item.correct ||
        translated.options.length !== item.options.length
      );
    })
  ) {
    throw new Error('invalidQuestionData');
  }
  return canonical.map((item) => byId.get(item.id) as AssessmentItem);
}

export function localizeAssessmentItems(
  relevant: AssessmentItem[],
  canonical: AssessmentItem[],
  localized: AssessmentItem[],
) {
  const byId = new Map(localizeAssessment(canonical, localized).map((item) => [item.id, item]));
  return relevant.map((item) => byId.get(item.id) as AssessmentItem);
}
