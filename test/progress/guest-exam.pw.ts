import { expect, test } from '@playwright/test';
import { answerCurrentQuestion, openExam, startStudy } from './course';
import {
  allowGuestStorage,
  answerExamQuestion,
  examKey,
  expectGuestKeys,
  historyKey,
  startCustomExam,
} from './guest-exam.helpers';

test('guest exam without consent is transient and disappears after submit and reload', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await startCustomExam(page, 1);
    await expectGuestKeys(page);
    await answerExamQuestion(page);
    await expectGuestKeys(page);
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await expectGuestKeys(page);
    await page.reload();
    await openExam(page);
    await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
    await expectGuestKeys(page);
  } finally {
    await context.close();
  }
});

test('consented guest exam draft keeps answer and flag across reload', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await allowGuestStorage(page);
    await startCustomExam(page, 2);
    await answerExamQuestion(page);
    await page.getByRole('button', { exact: true, name: '見直しマーク' }).click();
    await expect(page.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), examKey)).not.toBeNull();
    await page.reload();
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const inputs = [...document.querySelectorAll<HTMLInputElement>('input[name="exam-answer"]')];
          const fields = [
            ...document.querySelectorAll<HTMLSelectElement>('.structured-answer-fields select'),
          ];
          return inputs.length
            ? inputs.some((input) => input.checked)
            : fields.length > 0 && fields.every((field) => field.value);
        }),
      )
      .toBe(true);
    await expect(page.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});

test('guest study and a 15-question exam preserve 17 distinct answers across reload', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await allowGuestStorage(page);
    await startStudy(page);
    await answerCurrentQuestion(page);
    await startCustomExam(page, 15);
    for (let index = 0; index < 15; index += 1) {
      await answerExamQuestion(page, index + 1);
      if (index < 14) {
        await page.getByRole('button', { name: '次の問題' }).click();
        await expect(page.getByRole('heading', { name: new RegExp(`第${index + 2}問`) })).toBeVisible();
      }
    }
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await page.locator('.course-nav').getByRole('button', { name: '学ぶ' }).click();
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect(page.locator('.metrics')).toContainText('17');
    const rows = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown[]) : [];
    }, historyKey);
    expect(rows).toHaveLength(17);
    expect(new Set(rows.map((row) => JSON.stringify(row))).size).toBe(17);
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('17');
  } finally {
    await context.close();
  }
});
