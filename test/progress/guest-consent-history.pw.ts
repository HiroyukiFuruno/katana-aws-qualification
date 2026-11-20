import { expect, test } from '@playwright/test';
import {
  progressAttempts,
  saveGuestAttempt,
  seedDiskWrongAttempt,
  storedAttempts,
} from './guest-consent-history.helpers';

const analyticsConsent = 'katana-aws:analytics-consent';
const cookieConsent = 'katana-aws:cookie-consent';

test('guest consent merges a disk attempt with an unsaved memory attempt without losing provenance', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await expect(page.locator('.metrics strong').first()).toHaveText('0');
    const fixture = await seedDiskWrongAttempt(page);
    expect(fixture.seeded.isCorrect).toBe(false);
    expect(await saveGuestAttempt(page, fixture, fixture.selected[1])).toEqual({
      selected: [fixture.selected[1]],
      isCorrect: false,
      attemptNumber: 1,
      priorIncorrectCount: 0,
    });
    await expect
      .poll(() => progressAttempts(page))
      .toEqual([expect.objectContaining({ selected: [fixture.selected[1]], attemptNumber: 1 })]);
    expect(await storedAttempts(page)).toEqual([
      expect.objectContaining({ selected: [fixture.selected[0]], isCorrect: false }),
    ]);
    expect(
      await page.evaluate(
        (keys) => keys.map((key) => localStorage.getItem(key)),
        [analyticsConsent, cookieConsent],
      ),
    ).toEqual([null, null]);

    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await expect(page.locator('.metrics strong').first()).toHaveText('2');
    await expect
      .poll(() => progressAttempts(page))
      .toEqual([
        expect.objectContaining({ selected: [fixture.selected[0]], attemptNumber: 1 }),
        expect.objectContaining({ selected: [fixture.selected[1]] }),
      ]);
    expect(await storedAttempts(page)).toHaveLength(2);
    await page.reload();
    await expect(page.locator('.metrics strong').first()).toHaveText('2');
    await expect.poll(() => progressAttempts(page)).toHaveLength(2);

    expect(await saveGuestAttempt(page, fixture, fixture.selected[2])).toEqual({
      selected: [fixture.selected[2]],
      isCorrect: false,
      attemptNumber: 3,
      priorIncorrectCount: 2,
    });
    await expect(page.locator('.metrics strong').first()).toHaveText('3');
    await expect
      .poll(() => storedAttempts(page))
      .toEqual([
        expect.objectContaining({ selected: [fixture.selected[0]], isCorrect: false }),
        expect.objectContaining({ selected: [fixture.selected[1]], isCorrect: false }),
        expect.objectContaining({ selected: [fixture.selected[2]], isCorrect: false }),
      ]);
    expect(
      await page.evaluate(
        (keys) => keys.map((key) => localStorage.getItem(key)),
        [analyticsConsent, cookieConsent],
      ),
    ).toEqual([null, null]);

    await page.reload();
    await expect(page.locator('.metrics strong').first()).toHaveText('3');
    await expect.poll(() => progressAttempts(page)).toHaveLength(3);
  } finally {
    await context.close();
  }
});
