import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';

const website = 'https://katana-series.katana-projects.org';

for (const locale of locales) {
  test(`KatanA Website link preserves ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale));
    await expect(page.getByRole('link', { name: 'KatanA Website', exact: true })).toHaveAttribute(
      'href',
      `${website}${locale === 'en' ? '/' : `/${locale}/`}`,
    );
  });
}

test('KatanA Website link follows language changes and reloads', async ({ page }) => {
  await page.goto('/ja/');
  const link = page.getByRole('link', { name: 'KatanA Website', exact: true });
  await page.locator('#site-locale').selectOption('fr');
  await expect(link).toHaveAttribute('href', `${website}/fr/`);
  await page.reload();
  await expect(link).toHaveAttribute('href', `${website}/fr/`);
  await page.locator('#site-locale').selectOption('en');
  await expect(link).toHaveAttribute('href', `${website}/`);
});
