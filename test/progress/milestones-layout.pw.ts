import { expect, test } from '@playwright/test';
import { type Locale, locales } from '../../src/locales';
import { messages } from '../../src/messages';
import { addMilestone, expectNoHorizontalOverflow, openMemberMilestones } from './milestones.helpers';
import { createSessions, type RealSession } from './sessions';

let session: RealSession;

test.beforeAll(async ({ browser }) => {
  [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const panel = await openMemberMilestones(page, session);
    await addMilestone(panel, 'ja', {
      kind: 'study',
      title: 'native layout schedule',
      plannedOn: '2030-09-15',
    });
  } finally {
    await context.close();
  }
});

async function verifyLocale(page: Parameters<typeof openMemberMilestones>[0], locale: Locale) {
  const text = messages[locale];
  const panel = await openMemberMilestones(page, session, locale);
  await expect(panel).toContainText('native layout schedule');
  await expect(panel.locator('.milestone-calendar-grid tbody tr')).toHaveCount(6);
  for (const condition of [
    { theme: 'light', width: 375 },
    { theme: 'dark', width: 390 },
  ] as const) {
    await page.setViewportSize({ width: condition.width, height: 844 });
    const toggle = page.getByRole('button', { name: text.darkMode, exact: true });
    const current = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
    if (current !== condition.theme) await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe(condition.theme);
    await panel.getByRole('button', { name: text.milestoneAddSchedule, exact: true }).click();
    const form = panel.locator('.milestone-form');
    await form.getByLabel(text.milestoneTitleLabel, { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect
      .poll(() => form.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await form.getByRole('button', { name: text.cancel, exact: true }).click();
    await expect(form).toHaveCount(0);
    await expectNoHorizontalOverflow(page, condition.width);
  }
}

for (const locale of locales) {
  test(`member planning controls fit ${locale} at both mobile themes`, async ({ browser }) => {
    const context = await browser.newContext();
    try {
      await verifyLocale(await context.newPage(), locale);
    } finally {
      await context.close();
    }
  });
}
