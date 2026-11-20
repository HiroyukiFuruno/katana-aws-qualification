import { expect, type Page } from '@playwright/test';
import ja from '../../src/locales/ja.json' with { type: 'json' };

const historyKey = 'saa-study.attempts.v1';
const consentKey = 'katana.learning-progress-consent.v1';

export const dashboardText = ja;

async function questions(page: Page) {
  return page.evaluate(async () => {
    const { loadQuestions } = await import('/src/questions.ts');
    const source = await loadQuestions('courses/saa-c03/questions.json');
    const single = source.find((question) => !question.format && question.correct.length === 1);
    const multiple = source.find((question) => !question.format && question.correct.length > 1);
    if (!single || !multiple) throw new Error('Dashboard requires single and multiple choice fixtures.');
    const wrong = multiple.choices.find((choice) => !multiple.correct.includes(choice.id));
    if (!wrong) throw new Error('Dashboard multiple-choice fixture needs a wrong choice.');
    return [
      { multiple: false, question: single, selected: [single.correct[0]] },
      { multiple: true, question: multiple, selected: [wrong.id] },
    ];
  });
}

export async function seedGuestDashboardAttempts(page: Page) {
  const seeded = await questions(page);
  await page.evaluate(
    async ({ key, values }) => {
      const { makeAttempt } = await import('/src/attempts.ts');
      const history: unknown[] = [];
      const answeredBase = Date.now() - 120_000;
      for (const [index, value] of values.entries()) {
        history.push(
          makeAttempt(
            history as Parameters<typeof makeAttempt>[0],
            value.question as Parameters<typeof makeAttempt>[1],
            value.selected,
            'study',
            1000 + index,
            new Date(answeredBase + index * 1000).toISOString(),
          ),
        );
      }
      localStorage.setItem(key, JSON.stringify(history));
    },
    { key: historyKey, values: seeded },
  );
}

export async function saveMemberDashboardAttempts(page: Page) {
  const seeded = await questions(page);
  await page.evaluate(async (values) => {
    const { saveAttempt } = await import('/src/history.ts');
    for (const value of values) {
      await saveAttempt(value.question, value.selected, 'study', 1000, 'saa-c03');
    }
  }, seeded);
}

export async function clearGuestConsent(page: Page) {
  await page.evaluate((key) => localStorage.removeItem(key), consentKey);
}

export async function allowDashboardGuestStorage(page: Page) {
  await expect(
    page.getByRole('heading', { name: dashboardText.dashboardTitle, exact: true }),
  ).toBeVisible();
  const necessary = page.getByRole('button', { name: '必要なもののみ', exact: true });
  if (await necessary.isVisible()) await necessary.click();
  await page.getByRole('checkbox', { name: dashboardText.progressStorageAllow }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('granted');
}

function overview(page: Page) {
  return page
    .locator('.dashboard-widget')
    .filter({ has: page.getByRole('heading', { name: dashboardText.dashboardWidgetOverview }) });
}

export async function expectDashboardMetrics(page: Page, answered: string, accuracy: string) {
  const widget = overview(page);
  await expect(widget).toBeVisible();
  await expect(
    widget
      .locator('.dashboard-viz-metric')
      .filter({ hasText: dashboardText.dashboardMetricAnswered })
      .locator('strong'),
  ).toHaveText(answered);
  await expect(
    widget
      .locator('.dashboard-viz-metric')
      .filter({ hasText: dashboardText.dashboardMetricAccuracy })
      .locator('strong'),
  ).toHaveText(accuracy);
}

export function dashboardOverview(page: Page) {
  return overview(page);
}

export async function openWidgetCustomize(widget: ReturnType<typeof overview>) {
  const details = widget.locator('details.dashboard-widget-customize');
  await details.locator('summary').filter({ hasText: dashboardText.dashboardCustomize }).first().click();
  await expect(details).toHaveAttribute('open', '');
}

export async function openDashboardAdvanced(page: Page) {
  const controls = page.locator('.dashboard-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator(':scope > summary').click();
  const details = page.locator('.dashboard-controls details.dashboard-advanced-controls');
  await details.locator('summary').filter({ hasText: dashboardText.dashboardCustomize }).click();
  await expect(details).toHaveAttribute('open', '');
}
