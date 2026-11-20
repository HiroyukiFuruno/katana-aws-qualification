import { catalog } from './certificationCatalog.ts';
import { withAvailableCourses } from './certificationCourses.ts';
import { machineLearningEngineerBeta } from './machineLearningEngineerBeta.ts';

export { levelMessage, skills } from './certificationTypes.ts';
export type { Certification, Course, ExamBlueprint, Skill } from './certificationTypes.ts';

export const certifications = withAvailableCourses(catalog);
export const studyCourses = [...certifications, machineLearningEngineerBeta].filter(
  ({ course }) => course,
);
