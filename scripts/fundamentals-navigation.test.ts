import { expect, test } from 'bun:test';
import { lessonPath, lessonRouteAt } from '../src/fundamentals/delivery/navigation';
import { locales } from '../src/locales';

test('lesson paths roundtrip every locale and stage without exposing a session identifier', () => {
  for (const locale of locales) {
    for (const stage of ['resume', 'result'] as const) {
      const route = { locale, unitId: 'fundamentals.cidr-subnets', stage };
      const path = lessonPath(route);
      expect(lessonRouteAt(path)).toEqual(route);
      expect(path).not.toContain('?');
      expect(lessonRouteAt(path.slice(0, -1))).toEqual(route);
    }
    for (const stage of ['slides', 'checkpoints', 'final'] as const) {
      const route = { locale, unitId: 'fundamentals.cidr-subnets', stage, position: 12 };
      expect(lessonRouteAt(lessonPath(route))).toEqual(route);
    }
  }
});

test('lesson route codec rejects malformed positions, encoded units and unknown stage syntax', () => {
  for (const suffix of [
    'slides/0',
    'slides/01',
    'slides/-1',
    'slides/1.5',
    'slides/9007199254740992',
    'slides/1/extra',
    'final/session-id/1',
    'unknown/1',
    'result/1',
    'slides//1',
  ]) {
    expect(lessonRouteAt(`/ja/study/fundamentals/cidr-subnets/${suffix}/`)).toBeUndefined();
  }
  for (const slug of ['..', '%2e%2e', 'cidr%2fsubnets', 'cidr_subnets', 'CIDR', '-cidr']) {
    expect(lessonRouteAt(`/ja/study/fundamentals/${slug}/slides/1/`)).toBeUndefined();
  }
  expect(lessonRouteAt('/study/fundamentals/')).toBeUndefined();
  expect(lessonRouteAt('/en/study/fundamentals/cidr-subnets/slides/1/')).toBeUndefined();
  expect(() => lessonPath({ locale: 'ja', unitId: 'invalid', stage: 'resume' })).toThrow();
  expect(() =>
    lessonPath({ locale: 'ja', unitId: 'fundamentals.cidr-subnets', stage: 'slides', position: 0 }),
  ).toThrow();
});
