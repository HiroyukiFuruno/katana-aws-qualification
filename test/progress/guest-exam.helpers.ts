import { expect, type Page } from '@playwright/test';
import { openExam } from './course';

export const historyKey = 'saa-study.attempts.v1';
export const examKey = 'saa-study.exam.v1';
const progressConsentKey = 'katana.learning-progress-consent.v1';

export async function allowGuestStorage(page: Page) {
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), progressConsentKey))
    .toBe('granted');
}

export async function expectGuestKeys(page: Page) {
  await expect
    .poll(() =>
      page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), [historyKey, examKey]),
    )
    .toEqual([null, null]);
}

export async function startCustomExam(page: Page, count: number) {
  await openExam(page);
  await page.locator('.exam-format-picker select').selectOption('custom');
  await page.locator('.exam-format-picker input[type="number"]').fill(String(count));
  await page.getByRole('button', { name: '模擬試験を開始' }).click();
  await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
}

export async function answerExamQuestion(page: Page, position = 1) {
  const meta = (await page.locator('.question-meta').textContent()) ?? '';
  const required = Number(meta.match(/(\d+)つ選択/)?.[1] ?? 0);
  const choices = page.locator('input[name="exam-answer"]');
  if (required > 0) {
    for (let index = 0; index < required; index += 1) {
      const choice = choices.nth(index);
      await choice.check();
      await expect(choice).toBeChecked();
    }
  } else {
    const fields = page.locator('.structured-answer-fields select');
    const count = await fields.count();
    if (!count) throw new Error(`No answer controls found for: ${meta}`);
    for (let index = 0; index < count; index += 1) {
      const field = fields.nth(index);
      const values = await field
        .locator('option:not([value=""])')
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
      const value = values[index];
      if (!value) throw new Error(`Not enough structured choices for: ${meta}`);
      await field.selectOption(value);
      await expect(field).toHaveValue(value);
    }
  }
  await expect(page.getByRole('button', { name: new RegExp(`第${position}問 回答済み`) })).toBeVisible();
}
