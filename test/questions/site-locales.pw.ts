import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

for (const locale of locales) {
  test(`${locale}: translated landing content and FAQ remain usable on a narrow screen`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(localePath(locale, ''));
    const dictionary = messages[locale];
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(dictionary.landingTitle);
    await expect(page.locator('.landing-faq summary').first()).toHaveAccessibleName(
      dictionary.freeStudyQuestion,
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    if (locale !== 'ja')
      expect(await page.locator('main').textContent()).not.toMatch(
        /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
      );
    expect(errors).toEqual([]);
  });
}
