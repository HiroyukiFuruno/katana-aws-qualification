import { expect, test } from 'bun:test';
import { coursePageFromSearch } from '../src/coursePageQuery';
import { dashboardCourseLink } from '../src/dashboard/learningLinks';

test('dashboard course links open an existing localized review or exam tab', () => {
  const href = dashboardCourseLink('saa-c03', 'ja', 'review');
  expect(href).toBe('/ja/study/saa-c03/?mode=review');
  expect(coursePageFromSearch('?mode=review')).toBe('review');
  expect(coursePageFromSearch('?mode=exam')).toBe('exam');
  expect(coursePageFromSearch('?mode=arbitrary')).toBe('study');
  expect(coursePageFromSearch('')).toBe('study');
  expect(dashboardCourseLink('unavailable', 'ja', 'study')).toBeUndefined();
});
