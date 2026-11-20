import { expect, test, type Page } from '@playwright/test';
import {
  allowGuestStorage,
  answerExamQuestion,
  examKey,
  historyKey,
  startCustomExam,
} from './guest-exam.helpers';

const quotaKey = 'qa.guest-exam-quota.v1';

type DraftResponse = { selected: string[]; durationMs: number };
type DraftSnapshot = { id: string; responses: Record<string, DraftResponse> };

async function fillNativeQuota(page: Page) {
  return page.evaluate((key) => {
    const maxChars = 8 * 1024 * 1024;
    let value = '';
    let quotaReached = false;
    for (const size of [64 * 1024, 1024, 64]) {
      const chunk = 'q'.repeat(size);
      while (value.length + size <= maxChars) {
        try {
          const next = value + chunk;
          localStorage.setItem(key, next);
          value = next;
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'QuotaExceededError')) throw error;
          quotaReached = true;
          break;
        }
      }
    }
    if (!quotaReached || value.length <= 64)
      throw new Error('Native localStorage quota was not reached.');
    localStorage.setItem(key, value.slice(0, -64));
    return value.length;
  }, quotaKey);
}

async function readDraft(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Guest exam draft is missing.');
    return JSON.parse(raw) as DraftSnapshot;
  }, examKey);
}

async function changeCurrentAnswer(page: Page) {
  const choices = page.locator('input[name="exam-answer"]');
  const count = await choices.count();
  if (count) {
    const selected = await choices.evaluateAll((inputs) =>
      inputs.map((input, index) => ({ index, selected: (input as HTMLInputElement).checked })),
    );
    const selectedIndexes = selected.filter((item) => item.selected).map((item) => item.index);
    const alternatives = selected.filter((item) => !item.selected).map((item) => item.index);
    if (!alternatives.length) throw new Error('Exam question has no alternate answer.');
    await page.getByRole('button', { name: '選択を消す' }).click();
    await expect
      .poll(() =>
        choices.evaluateAll(
          (inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length,
        ),
      )
      .toBe(0);
    for (let index = 0; index < selectedIndexes.length; index += 1) {
      const alternative = alternatives[index];
      if (alternative === undefined) throw new Error('Exam question has too few alternate answers.');
      await choices.nth(alternative).check();
    }
    await expect(choices.nth(alternatives[0])).toBeChecked();
    return;
  }
  const fields = page.locator('.structured-answer-fields select');
  const fieldCount = await fields.count();
  if (!fieldCount) throw new Error('No exam answer controls found.');
  for (let index = 0; index < fieldCount; index += 1) {
    const field = fields.nth(index);
    const values = await field
      .locator('option:not([value=""])')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    const current = await field.inputValue();
    const next = values.find((value) => value !== current);
    if (!next) throw new Error('Structured exam answer has no alternate value.');
    await field.selectOption(next);
    await expect(field).toHaveValue(next);
  }
}

test('guest exam retries after history quota failure using the updated prepared draft', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await allowGuestStorage(page);
    await startCustomExam(page, 1);
    await answerExamQuestion(page);
    const before = await readDraft(page);
    const beforeResponse = Object.values(before.responses)[0];
    if (!beforeResponse) throw new Error('Exam response was not prepared.');
    const filled = await fillNativeQuota(page);
    expect(filled).toBeGreaterThan(0);
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect(page.getByText(/採点結果を保存できませんでした/)).toBeVisible();
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBeNull();
    const prepared = await readDraft(page);
    const preparedResponse = Object.values(prepared.responses)[0];
    expect(preparedResponse?.selected).toEqual(beforeResponse.selected);
    expect(preparedResponse?.durationMs).toBeGreaterThan(beforeResponse.durationMs);
    await page.evaluate((key) => localStorage.removeItem(key), quotaKey);
    await changeCurrentAnswer(page);
    const changed = await readDraft(page);
    const changedResponse = Object.values(changed.responses)[0];
    expect(changedResponse?.selected).not.toEqual(preparedResponse?.selected);
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    const history = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { selected: string[] }[]) : [];
    }, historyKey);
    expect(history).toHaveLength(1);
    expect(history[0]?.selected).toEqual(changedResponse?.selected);
  } finally {
    await context.close();
  }
});
