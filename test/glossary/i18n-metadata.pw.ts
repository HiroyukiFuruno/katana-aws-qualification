import { expect, test } from '@playwright/test';
import { assessmentDate, assessmentItems } from '../../src/assessment';
import { certifications, skills } from '../../src/certifications';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

for (const locale of locales) {
  test(`${locale}: 一覧の分野説明と査定の技能名を翻訳する`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(localePath(locale, 'certifications'));
    await page.getByRole('button', { name: messages[locale].cookieNecessary, exact: true }).click();
    for (const certification of certifications) {
      const row = page.locator(
        `a.certification-row[href="${localePath(locale, `certifications/${certification.id}`)}"]`,
      );
      await expect(row.locator('p')).toHaveText(messages[locale][certification.focus]);
      await expect(row.locator('[lang="ja"]')).toHaveCount(0);
      if (locale !== 'ja') {
        await expect(row).not.toContainText(messages.ja[certification.focus]);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.goto(localePath(locale, 'assessment'));
    await page.locator('section.roadmap-card > button.primary').click();
    const first = assessmentItems([], assessmentDate())[0];
    await expect(page.locator('section.roadmap-card .eyebrow')).toContainText(
      messages[locale][skills[first.skill]],
    );
    if (locale !== 'ja') {
      await expect(page.locator('section.roadmap-card .eyebrow')).not.toContainText(
        messages.ja[skills[first.skill]],
      );
    }
    await expect(page.locator('section.roadmap-card h2')).toHaveAttribute('lang', 'ja');
  });
}
