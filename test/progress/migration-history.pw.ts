import { expect, test } from '@playwright/test';
import { createSessions, setRealSession } from './sessions';
import { historyKey, items, learningEvents, manifests, validAttempt } from './migration-history.helpers';

test('normal legacy history imports its real question event and survives reload', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const raw = JSON.stringify([validAttempt]);
    await page.goto('/ja/study/saa-c03/');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: historyKey,
      value: raw,
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect.poll(() => manifests(session)).toEqual([]);
    await expect.poll(() => learningEvents(session)).toEqual([]);
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect
      .poll(() => manifests(session))
      .toEqual([expect.objectContaining({ status: 'completed', declared_rows: 1 })]);
    const [manifest] = await manifests(session);
    await expect
      .poll(() => items(session, manifest.manifest_id))
      .toEqual([expect.objectContaining({ source_row_id: 'history-0', outcome: 'accepted' })]);
    await expect
      .poll(() => learningEvents(session))
      .toEqual([
        expect.objectContaining({
          certification_id: 'saa-c03',
          question_id: 'mock-secure-01',
          question_revision: 2,
          selected: ['A'],
          is_correct: true,
        }),
      ]);
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBeNull();
    await page.goto('/ja/study/saa-c03/');
    await setRealSession(page, session);
    await page.reload();
    await expect(page.locator('.metrics strong').first()).toHaveText('1');
  } finally {
    await context.close();
  }
});

test('mixed legacy history imports valid rows and retains the corrupt source', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const raw = JSON.stringify([validAttempt, { malformed: true }]);
    await page.goto('/ja/study/saa-c03/');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: historyKey,
      value: raw,
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect(page.getByText(/この端末の記録1件/)).toBeVisible();
    await expect.poll(() => manifests(session)).toEqual([]);
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect(
      page.getByText('取り込めない記録があります。端末の元データは残っています。'),
    ).toBeVisible();
    await expect
      .poll(() => manifests(session))
      .toEqual([expect.objectContaining({ status: 'completed', declared_rows: 2 })]);
    const [manifest] = await manifests(session);
    await expect
      .poll(() => items(session, manifest.manifest_id))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source_row_id: 'history-0', outcome: 'accepted' }),
          expect.objectContaining({
            source_row_id: 'corrupt-0',
            outcome: 'rejected',
            reason_code: 'corrupt_attempt',
          }),
        ]),
      );
    await expect.poll(() => learningEvents(session)).toHaveLength(1);
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBe(raw);
  } finally {
    await context.close();
  }
});
