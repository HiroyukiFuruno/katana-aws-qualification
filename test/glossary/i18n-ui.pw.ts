import { expect, type Page, test } from '@playwright/test';
import { type Locale, localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

const widths = [390, 1280];
const oldEnglish = [
  ['landingPace', 'LEARN AT YOUR PACE'],
  ['landingConceptLabel', '01 / CONCEPT'],
  ['landingValueLabel', '02 / VALUE'],
  ['landingAccountLabel', '03 / ACCOUNT'],
  ['landingNextStepLabel', '04 / YOUR NEXT STEP'],
  ['katanaWebsite', 'KatanA Website'],
] as const;

async function expectNoOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

async function expectLandingCopy(page: Page, locale: Locale) {
  const copy = messages[locale];
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('.landing-identity')).toContainText(copy.landingPace);
  const kickers = [
    ['.landing-concept', copy.landingConceptLabel],
    ['.landing-values', copy.landingValueLabel],
    ['.landing-account-pitch', copy.landingAccountLabel],
    ['.landing-paths', copy.landingNextStepLabel],
  ];
  for (const [section, label] of kickers) {
    await expect(page.locator(`${section} .landing-kicker`)).toHaveText(label);
  }
  await expect(page.locator('.site-footer .brand')).toHaveText(copy.siteName);
  await expect(
    page.locator('.site-footer').getByRole('link', { name: copy.katanaWebsite }),
  ).toBeVisible();
  await expect(page.locator('.site-header .brand')).toHaveAccessibleName(copy.siteName);
  if (locale !== 'en') {
    for (const [key, english] of oldEnglish) {
      if (copy[key] !== english) {
        await expect(page.getByText(english, { exact: true })).toHaveCount(0);
      }
    }
  }
}

for (const width of widths) {
  for (const locale of locales) {
    test(`${locale}: ${width}pxのLP翻訳・言語切替・横幅`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localePath(locale));
      await page.getByRole('button', { name: messages[locale].cookieNecessary, exact: true }).click();
      await expect(page.locator('.cookie-banner')).toHaveCount(0);
      await expectLandingCopy(page, locale);
      const chooser = page.locator('#site-locale');
      await expect(chooser.locator('option')).toHaveText(
        locales.map((value) => messages[value].localeName),
      );
      await expect(chooser).toHaveValue(locale);
      await expectNoOverflow(page, width);
      const next = locale === 'ja' ? 'en' : 'ja';
      const previousTitle = messages[locale].landingTitle;
      await chooser.selectOption(next);
      await expect(page).toHaveURL(localePath(next));
      await expectLandingCopy(page, next);
      await expect(page.locator('.landing-hero h1')).not.toHaveText(previousTitle);
      await expect(chooser).toHaveValue(next);
      await expect(page.locator('.cookie-banner')).toHaveCount(0);
      await expectNoOverflow(page, width);
    });

    test(`${locale}: ${width}pxの未登録URLは翻訳済み404`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(localePath(locale, 'not-a-registered-page'));
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages[locale].pageNotFound);
      await expect(
        page.getByRole('link', { name: messages[locale].siteName, exact: true }),
      ).toHaveAttribute('href', localePath(locale));
      if (locale !== 'en') {
        await expect(page.locator('body')).not.toContainText('404 — Page not found');
      }
      await expectNoOverflow(page, width);
    });
  }
}
