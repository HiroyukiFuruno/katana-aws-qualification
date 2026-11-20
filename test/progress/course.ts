import { expect, type Page } from '@playwright/test';
import type { RealSession } from './sessions';
import { setRealSession } from './sessions';

export async function openMemberCourse(page: Page, session: RealSession) {
  await page.goto('/ja/study/saa-c03/');
  await setRealSession(page, session);
  await page.reload();
  await expect(page.getByRole('heading', { name: '問題から学ぶ' })).toBeVisible();
}

export async function startStudy(page: Page) {
  await page.getByRole('button', { name: '学習を始める' }).click();
  await expect(page.locator('input[name="answer"]').first()).toBeVisible();
}

export async function answerCurrentQuestion(page: Page) {
  const grade = page.getByRole('button', { name: '採点する' });
  const choices = page.locator('input[name="answer"]');
  for (let index = 0; index < (await choices.count()); index++) {
    if (await grade.isEnabled()) break;
    await choices.nth(index).check();
  }
  await expect(grade).toBeEnabled();
  await grade.click();
  await expect(
    page.locator('section[aria-labelledby="question-title"]').getByRole('status'),
  ).toBeVisible();
}

export async function openExam(page: Page) {
  await page.getByRole('button', { name: '模擬試験' }).click();
  await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
}
