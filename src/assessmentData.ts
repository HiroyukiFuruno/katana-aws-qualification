import sourceContent from './content/ja.json' with { type: 'json' };
import type { AssessmentItem } from './assessmentTypes';

export const assessmentData: AssessmentItem[] = sourceContent.assessment.slice(0, 9) as AssessmentItem[];
