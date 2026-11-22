import { expect, type Page, test } from '@playwright/test';
import { type Locale, localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

const website = 'https://katana-series.katana-projects.org';

async function expectWebsite(page: Page, locale: Locale) {
  await expect(
    page.getByRole('link', { name: messages[locale].katanaWebsite, exact: true }),
  ).toHaveAttribute('href', `${website}${locale === 'en' ? '/' : `/${locale}/`}`);
}

for (const locale of locales) {
  test(`KatanA Website link preserves ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale));
    await expectWebsite(page, locale);
  });
}

test('KatanA Website link follows language changes and reloads', async ({ page }) => {
  await page.goto('/ja/');
  await expectWebsite(page, 'ja');
  await page.locator('#site-locale').selectOption('fr');
  await expectWebsite(page, 'fr');
  await page.reload();
  await expectWebsite(page, 'fr');
  await page.locator('#site-locale').selectOption('en');
  await expectWebsite(page, 'en');
});
