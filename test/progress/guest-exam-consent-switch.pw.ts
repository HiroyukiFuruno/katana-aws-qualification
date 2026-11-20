import { expect, test } from '@playwright/test';
import { allowGuestStorage, answerExamQuestion, examKey, startCustomExam } from './guest-exam.helpers';

const consentLabel = 'ゲストの学習記録をこの端末に保存する';

test('guest exam consent withdrawal keeps disk draft immutable and restores it after re-consent', async ({
  browser,
}) => {
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
    const savedDraft = await page.evaluate((key) => localStorage.getItem(key), examKey);
    if (!savedDraft) throw new Error('The consented guest draft was not saved.');

    const consent = page.getByLabel(consentLabel);
    await consent.uncheck();
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
    await expect(page.evaluate((key) => localStorage.getItem(key), examKey)).resolves.toBe(savedDraft);

    await page.reload();
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
    await expect(page.getByText(/同意しない場合/)).toBeVisible();
    await page.getByLabel(consentLabel).check();
    await expect(page.getByRole('heading', { name: '第1問' })).toBeVisible();
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});

test('guest exam consent changes synchronize across two native storage tabs', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    await first.goto('/ja/study/saa-c03/');
    await allowGuestStorage(first);
    await startCustomExam(first, 2);
    await answerExamQuestion(first);
    await first.getByRole('button', { exact: true, name: '見直しマーク' }).click();
    await expect(first.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => first.evaluate((key) => localStorage.getItem(key), examKey)).not.toBeNull();
    const savedDraft = await first.evaluate((key) => localStorage.getItem(key), examKey);
    if (!savedDraft) throw new Error('The first tab did not save its guest draft.');

    const second = await context.newPage();
    await second.goto('/ja/study/saa-c03/');
    const secondConsent = second.getByLabel(consentLabel);
    await expect(secondConsent).toBeChecked();
    await secondConsent.uncheck();
    await expect(secondConsent).not.toBeChecked();
    await expect(first.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
    await expect(first.evaluate((key) => localStorage.getItem(key), examKey)).resolves.toBe(savedDraft);

    await secondConsent.check();
    await expect(first.getByRole('heading', { name: '第1問' })).toBeVisible();
    await expect(first.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(first.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});
