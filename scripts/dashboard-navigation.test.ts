import { expect, test } from 'bun:test';
import { coursePageFromSearch } from '../src/coursePageQuery';
import { dashboardCourseLink, dashboardLessonLink } from '../src/dashboard/learningLinks';
import type { DashboardLessonData } from '../src/dashboard/viewTypes';
import { lessonAsset } from './fundamentals-state-fixture';
import { dashboardGuestLesson } from '../src/dashboard/guestLessonEvents';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';

test('dashboard course links open an existing localized review or exam tab', () => {
  const href = dashboardCourseLink('saa-c03', 'ja', 'review');
  expect(href).toBe('/ja/study/saa-c03/?mode=review');
  expect(coursePageFromSearch('?mode=review')).toBe('review');
  expect(coursePageFromSearch('?mode=exam')).toBe('exam');
  expect(coursePageFromSearch('?mode=arbitrary')).toBe('study');
  expect(coursePageFromSearch('')).toBe('study');
  expect(dashboardCourseLink('unavailable', 'ja', 'study')).toBeUndefined();
});

test('lesson review links preserve the recorded edition instead of resuming the current edition', () => {
  const unitId = lessonAsset.unit.id;
  const lessons: DashboardLessonData[] = [
    {
      unitId,
      title: lessonAsset.unit.title,
      href: '/ja/study/fundamentals/cloud-concepts/',
      summary: dashboardGuestLesson(initialGuestLesson(lessonAsset), lessonAsset).summary,
    },
  ];
  const version = 'a'.repeat(64);
  expect(dashboardLessonLink(unitId, version, lessons, 'ja')).toBe(
    `/ja/study/fundamentals/cloud-concepts/?version=${version}`,
  );
  expect(dashboardLessonLink(unitId, null, lessons, 'ja')).toBeUndefined();
  expect(dashboardLessonLink('fundamentals.unknown', version, lessons, 'ja')).toBeUndefined();
});
