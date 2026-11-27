import { expect, test } from 'bun:test';
import {
  privateLessonPageNames,
  publicLessonPageNames,
} from '../src/fundamentals/delivery/routePages.ts';
import { locales } from '../src/locales.ts';
import { localizedBuildContent } from './localized-build-content.ts';

test('derives localized, route-specific public lesson metadata and static copy', async () => {
  for (const locale of locales) {
    const content = await localizedBuildContent(locale);
    for (const page of publicLessonPageNames) {
      const lesson = await content.lessonFor(page);
      if (!lesson) throw new Error(`Missing lesson: ${locale}/${page}`);
      expect(lesson.title.trim()).not.toBe('');
      expect(lesson.description.trim()).not.toBe('');
      expect(lesson.body.heading.trim()).not.toBe('');
      expect(lesson.body.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of lesson.body.paragraphs) expect(paragraph.trim()).not.toBe('');
      if (page.includes('/checkpoints/')) {
        expect(lesson.body.heading).not.toBe('checkpoint');
        expect(lesson.body.paragraphs[0]).not.toBe('');
      }
    }
  }
});

test('keeps private lesson route titles outside static public content', async () => {
  for (const locale of locales) {
    const content = await localizedBuildContent(locale);
    for (const page of privateLessonPageNames) {
      expect(await content.lessonFor(page)).toBeUndefined();
      expect(await content.titleFor(page)).not.toBeUndefined();
    }
  }
});

test('uses certification guide scope as the localized search description', async () => {
  const content = await localizedBuildContent('en');
  expect(content.descriptionFor('certifications/clf-c02')).toBe(
    'Assesses your understanding of the value of the AWS Cloud, the shared responsibility model, the roles of key services, pricing, and support.',
  );
});
