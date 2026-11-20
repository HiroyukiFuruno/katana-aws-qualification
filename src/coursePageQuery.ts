import type { CoursePage } from './CourseNavigation';

export function coursePageFromSearch(search: string): CoursePage {
  const page = new URLSearchParams(search).get('mode');
  return page === 'review' || page === 'exam' || page === 'settings' ? page : 'study';
}
