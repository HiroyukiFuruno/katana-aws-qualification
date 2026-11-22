import { expect, type Page } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import type { Locale } from '../../src/locales';
import { messages } from '../../src/messages';
import { acceptNecessaryCookies } from '../progress/fundamentals-mobile.helpers';

export async function openLocalizedLessonCatalogFixture(page: Page, locale: Locale = 'ja') {
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  if (locale !== 'ja')
    await page.getByRole('combobox', { name: messages.ja.language, exact: true }).selectOption(locale);
}

export async function openLocalizedLessonFixture(
  page: Page,
  asset: DeliveryUnitAsset,
  locale: Locale = 'ja',
) {
  const first = asset.steps[0];
  if (!first) throw new Error('Missing real first lesson step.');
  await openLocalizedLessonCatalogFixture(page, locale);
  const href = lessonPath({ locale, unitId: asset.unit.id, stage: 'resume' });
  await page.locator(`.lesson-catalog-card a[href="${href}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${stepHref(locale, first, asset)}$`));
}
