import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { type Message, messages } from '../../src/messages';

const sections: [string, Message][] = [
  ['assessment', 'skillsAssessment'],
  ['certifications', 'certGuides'],
  ['glossary', 'glossary'],
  ['privacy', 'privacy'],
  ['study', 'study'],
  ['study/questions', 'learnFromQuestions'],
  ['login', 'accountSignIn'],
  ['dashboard', 'dashboardTitle'],
];

for (const locale of locales) {
  test(`${locale}: core sections use the selected language without Japanese leakage`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [path, heading] of sections) {
      await page.goto(localePath(locale, path));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages[locale][heading]);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const text = await page.locator('main').textContent();
      if (locale !== 'ja') expect(text).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      if (locale !== 'ja' && !locale.startsWith('zh')) expect(text).not.toMatch(/\p{Script=Han}/u);
    }
    expect(errors).toEqual([]);
  });
}
