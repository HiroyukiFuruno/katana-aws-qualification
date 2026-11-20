import { studyCourses } from '../certifications';
import { lessonPath } from '../fundamentals/delivery/navigation';
import { type Locale, localePath } from '../locales';
import type { DashboardLessonData } from './viewTypes';

export function dashboardLessonLink(
  unitId: string,
  contentVersion: string | null,
  lessons: readonly DashboardLessonData[],
  locale: Locale,
) {
  const lesson = lessons.find((lesson) => lesson.unitId === unitId);
  if (!lesson || !contentVersion) return undefined;
  return lessonPath({ locale, unitId, stage: 'resume', contentVersion });
}

export function dashboardCourseLink(
  certificationId: string,
  locale: Locale,
  mode: 'study' | 'review' | 'exam',
) {
  const course = studyCourses.find((course) => course.id === certificationId);
  return course
    ? `${localePath(course.course?.studyLocale ?? locale, `study/${course.id}`)}?mode=${mode}`
    : undefined;
}
