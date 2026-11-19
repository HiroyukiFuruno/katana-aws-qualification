import { catalog } from './certificationCatalog.ts';
import { withAvailableCourses } from './certificationCourses.ts';

export { levelMessage, skills } from './certificationTypes.ts';
export type { Certification, Course, ExamBlueprint, Skill } from './certificationTypes.ts';

export const certifications = withAvailableCourses(catalog);
