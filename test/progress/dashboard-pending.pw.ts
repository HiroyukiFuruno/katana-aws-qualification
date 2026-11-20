import { expect, test } from '@playwright/test';
import { lessonOutboxKey } from '../../src/fundamentals/state/outboxCodec';
import { allowDashboardGuestStorage, dashboardText, expectDashboardMetrics } from './dashboard.helpers';
import { createSessions, setRealSession } from './sessions';

test('dashboard reports only current-owner pending lesson work without replay or local aggregation', async ({
  page,
}) => {
  const [first, second] = await createSessions();
  await page.goto('/ja/dashboard/');
  await setRealSession(page, first);
  await expectDashboardMetrics(page, '0', dashboardText.dashboardNotMeasured);
  const key = lessonOutboxKey(first.userId);
  const raw = JSON.stringify({
    version: 1,
    userId: first.userId,
    generation: 0,
    commands: [
      {
        commandId: crypto.randomUUID(),
        contentVersion: 'v1',
        unitId: 'fundamentals.cloud-concepts',
        kind: 'startFinal',
        input: { expectedRevision: 0, sessionId: crypto.randomUUID() },
      },
    ],
  });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: dashboardText.dashboardPending }),
  ).toBeVisible();
  await expectDashboardMetrics(page, '0', dashboardText.dashboardNotMeasured);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  await page.evaluate((key) => localStorage.setItem(key, '{'), key);
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: dashboardText.dashboardPendingReadFailed }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{');
  await setRealSession(page, second);
  await expectDashboardMetrics(page, '0', dashboardText.dashboardNotMeasured);
  await expect(
    page.getByRole('alert').filter({ hasText: dashboardText.dashboardPendingReadFailed }),
  ).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: dashboardText.dashboardPending })).toHaveCount(
    0,
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{');
});

test('consented guest dashboard ignores member-only pending buffers', async ({ page }) => {
  await page.goto('/ja/dashboard/');
  await allowDashboardGuestStorage(page);
  const key = lessonOutboxKey('11111111-1111-4111-8111-111111111111');
  await page.evaluate((key) => localStorage.setItem(key, '{'), key);
  await page.reload();
  await expectDashboardMetrics(page, '0', dashboardText.dashboardNotMeasured);
  await expect(
    page.getByRole('alert').filter({ hasText: dashboardText.dashboardPendingReadFailed }),
  ).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: dashboardText.dashboardPending })).toHaveCount(
    0,
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{');
});
