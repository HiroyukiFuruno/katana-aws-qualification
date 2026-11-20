import { studyCourses } from '../certifications';
import { type Locale, localePath } from '../locales';

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
