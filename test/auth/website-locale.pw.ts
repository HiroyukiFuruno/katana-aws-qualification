import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

const website = 'https://katana-series.katana-projects.org';

for (const locale of locales) {
  test(`KatanA Website link preserves ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale));
    await expect(
      page.getByRole('link', { name: messages[locale].katanaWebsite, exact: true }),
    ).toHaveAttribute('href', `${website}${locale === 'en' ? '/' : `/${locale}/`}`);
  });
}

test('KatanA Website link follows language changes and reloads', async ({ page }) => {
  await page.goto('/ja/');
  const frenchLink = page.getByRole('link', { name: messages.fr.katanaWebsite, exact: true });
  await page.locator('#site-locale').selectOption('fr');
  await expect(frenchLink).toHaveAttribute('href', `${website}/fr/`);
  await page.reload();
  await expect(frenchLink).toHaveAttribute('href', `${website}/fr/`);
  await page.locator('#site-locale').selectOption('en');
  await expect(page.getByRole('link', { name: messages.en.katanaWebsite, exact: true })).toHaveAttribute(
    'href',
    `${website}/`,
  );
});
