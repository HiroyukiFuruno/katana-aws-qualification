import sourceContent from './content/ja.json' with { type: 'json' };
import type { AssessmentItem } from './assessmentTypes';

export const assessmentExtra: AssessmentItem[] = sourceContent.assessment.slice(
  9,
  16,
) as AssessmentItem[];
