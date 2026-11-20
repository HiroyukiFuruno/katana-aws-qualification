import { expect, test } from '@playwright/test';
import { certificationGuides } from '../../src/certificationGuides';
import { certifications } from '../../src/certifications';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

const guides = Object.entries(certificationGuides);
const japaneseOriginals = guides.flatMap(([, guide]) =>
  [guide.scope, guide.why, guide.audience].map((key) => messages.ja[key]),
);

for (const locale of locales) {
  test(`${locale}: 13資格ガイドの翻訳・正式名・390px表示`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    for (const [index, [id, guide]] of guides.entries()) {
      await test.step(id, async () => {
        const certification = certifications.find((entry) => entry.id === id);
        if (!certification) throw new Error(`Missing certification: ${id}`);
        await page.goto(localePath(locale, `certifications/${id}`));
        if (index === 0) {
          await page
            .getByRole('button', { name: messages[locale].cookieNecessary, exact: true })
            .click();
        }
        await expect(page.locator('.cookie-banner')).toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(certification.name);
        const article = page.locator('article.card');
        await expect(article.locator(':scope > p')).toHaveText([
          messages[locale][guide.scope],
          messages[locale][guide.why],
          messages[locale][guide.audience],
        ]);
        await expect(article.locator('[lang="ja"]')).toHaveCount(0);
        if (locale !== 'ja') {
          const renderedGuide = await article.textContent();
          for (const original of japaneseOriginals) expect(renderedGuide).not.toContain(original);
        }
        if (id === 'clf-c02' && locale === 'en') {
          await expect(article).toContainText('shared responsibility model');
          await expect(article).not.toContainText('責任共有モデル');
        }
        if (id === 'clf-c02' && locale === 'ja') {
          await expect(article).toContainText('責任共有モデル');
          await expect(article).not.toContainText('shared responsibility model');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      });
    }
  });
}
