import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

test('KAQ leads with relaxed learning and explains exam preparation as a use', async ({ page }) => {
  await page.goto('/ja/');
  await expect(page.locator('main h1')).toHaveText('気楽に学ぶ、AWS。');
  await expect(page.locator('.landing-hero')).not.toContainText('試験対策');
  const concept = page.locator('.landing-concept');
  await expect(concept).toContainText('AWS認定資格の試験対策');
  await expect(concept).toContainText('まとまった時間や大きな目標がなくても大丈夫');
});

for (const locale of locales) {
  test(`KAQ explains its learning concept in ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale));
    await expect(page.locator('main h1')).toHaveText(messages[locale].landingTitle);
    await expect(page.locator('.landing-hero')).toContainText('KAQ');
    const concept = page.locator('.landing-concept');
    await expect(concept).toBeVisible();
    await expect(concept.getByRole('heading', { level: 2 })).not.toBeEmpty();
    await expect(concept.locator('p')).toHaveCount(2);
    await expect(concept).toContainText('AWS');
  });
}
