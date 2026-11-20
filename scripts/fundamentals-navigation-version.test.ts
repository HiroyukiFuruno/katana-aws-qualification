import { expect, test } from 'bun:test';
import { locales } from '../src/locales';
import { lessonPath, lessonRouteAt } from '../src/fundamentals/delivery/navigation';
import {
  reachableLessonHref,
  resumeLessonHref,
  stepHref,
} from '../src/fundamentals/delivery/planNavigation';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { guestLessonSnapshot } from '../src/fundamentals/state/guestSnapshot';
import { lessonAsset } from './fundamentals-state-fixture';

const version = 'a'.repeat(64);

test('lesson version routes preserve every locale and stage', () => {
  for (const locale of locales) {
    for (const route of [
      { locale, unitId: 'fundamentals.cloud-concepts', stage: 'resume' as const },
      { locale, unitId: 'fundamentals.cloud-concepts', stage: 'result' as const },
      { locale, unitId: 'fundamentals.cloud-concepts', stage: 'slides' as const, position: 1 },
      { locale, unitId: 'fundamentals.cloud-concepts', stage: 'checkpoints' as const, position: 2 },
      { locale, unitId: 'fundamentals.cloud-concepts', stage: 'final' as const, position: 1 },
    ]) {
      const href = lessonPath({ ...route, contentVersion: version });
      expect(
        lessonRouteAt(new URL(href, 'https://example.test').pathname, `?version=${version}`),
      ).toEqual({ ...route, contentVersion: version });
      expect(lessonPath(route)).not.toContain('?');
    }
  }
});

test('lesson version routes reject malformed query', () => {
  for (const query of [
    '?version=',
    '?version=ABC',
    '?version=abc',
    `?version=${version}&x=1`,
    `?version=${version}&version=${version}`,
  ])
    expect(lessonRouteAt('/ja/study/fundamentals/cloud-concepts/', query)).toBeUndefined();
});

test('step and resume preserve an edition while current navigation accepts optional undefined', () => {
  const step = lessonAsset.steps[0];
  if (!step) throw new Error('Missing reading fixture');
  const snapshot = guestLessonSnapshot(initialGuestLesson(lessonAsset), lessonAsset);
  for (const locale of locales) {
    const current = stepHref(locale, step, lessonAsset);
    expect(current).not.toContain('?');
    expect(resumeLessonHref(locale, lessonAsset, snapshot)).toBe(current);
    expect(
      reachableLessonHref(
        { locale, unitId: lessonAsset.unit.id, stage: 'resume' },
        lessonAsset,
        snapshot,
      ),
    ).toBe(current);
    const archived = `${current}?version=${version}`;
    expect(stepHref(locale, step, lessonAsset, version)).toBe(archived);
    expect(resumeLessonHref(locale, lessonAsset, snapshot, version)).toBe(archived);
    expect(
      reachableLessonHref(
        { locale, unitId: lessonAsset.unit.id, stage: 'resume', contentVersion: version },
        lessonAsset,
        snapshot,
      ),
    ).toBe(archived);
  }
  expect(() =>
    lessonPath({ locale: 'ja', unitId: lessonAsset.unit.id, stage: 'resume', contentVersion: '' }),
  ).toThrow('version');
});
