import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import { locales } from '../../src/locales';
import { messages } from '../../src/messages';
import { lessonAssets, nextButton, selectLessonAnswer } from '../progress/fundamentals.helpers';
import { openLocalizedLessonFixture } from './fundamentals-locale-helpers';

for (const locale of locales) {
  test(`${locale}: fundamentals reading and graded checkpoints use real localized content`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const asset = lessonAssets[0];
    const first = asset?.steps[0];
    const checkpoint = asset?.steps.find((step) => step.kind === 'checkpoint');
    if (!asset || !first || !checkpoint) throw new Error('Missing real lesson fixture.');
    const slug = asset.unit.id.replace(/^fundamentals\./, '');
    const localized: DeliveryUnitAsset =
      locale === 'ja'
        ? asset
        : JSON.parse(
            await readFile(
              new URL(
                `../../public/translations/${locale}/fundamentals/delivery/${slug}.json`,
                import.meta.url,
              ),
              'utf8',
            ),
          );
    await openLocalizedLessonFixture(page, asset, locale);
    const reading = localized.steps.find((item) => item.id === first.id);
    if (!reading) throw new Error('Localized reading step changed identity.');
    await expect(page.locator('.lesson-slide-content h1')).toHaveText(reading.label);
    for (const block of reading.blocks)
      await expect(page.locator('.lesson-reading')).toContainText(block.text);
    for (const step of asset.steps) {
      if (step.id === checkpoint.id) break;
      await expect(page).toHaveURL(new RegExp(`${stepHref(locale, step, asset)}$`));
      await nextButton(page).click();
    }
    const question = asset.checkpoints.find((item) => item.id === checkpoint.assessmentId);
    const translated = localized.checkpoints.find((item) => item.id === question?.id);
    if (!question || !translated) throw new Error('Missing real localized checkpoint.');
    await expect(page.locator('.lesson-slide-content h1')).toHaveText(messages[locale].lessonAssessment);
    await expect(page.locator('.lesson-assessment-prompt')).toHaveText(translated.prompt);
    const choices = page.locator('.lesson-assessment input');
    const order = await choices.evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
    expect([...order].sort()).toEqual(question.choices.map((choice) => choice.id).sort());
    await expect(page.locator('.lesson-choice > span')).toHaveText(
      order.map((id) => {
        const choice = translated.choices.find((item) => item.id === id);
        if (!choice) throw new Error('Localized choice changed identity.');
        return choice.text;
      }),
    );
    await selectLessonAnswer(page, question, question.correct);
    await page
      .getByRole('button', { name: messages[locale].lessonCheckpointSubmit, exact: true })
      .click();
    await expect(page.locator('.lesson-assessment [role=status]')).toHaveText(
      messages[locale].lessonCheckpointCorrect,
    );
    for (const choice of translated.choices)
      await expect(page.locator(`label[for="${translated.id}-${choice.id}"]`)).toContainText(
        choice.explanation,
      );
    for (const id of question.correct)
      await expect(page.locator(`fieldset input[value="${id}"]`)).toBeChecked();
    expect(
      await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
    ).toEqual(order);
    const content = await page.locator('.lesson-slide-content').textContent();
    if (locale !== 'ja') {
      expect(content).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      if (!locale.startsWith('zh')) expect(content).not.toMatch(/\p{Script=Han}/u);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
