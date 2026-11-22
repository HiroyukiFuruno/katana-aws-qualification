import { expect, test } from '@playwright/test';
import { canonicalInstant } from '../../src/milestones/dates';
import { milestoneRows, openMemberMilestones } from './milestones.helpers';
import { createSessions } from './sessions';

test('New York browser rejects a DST gap and stores a valid local schedule as its real UTC instant', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext({ timezoneId: 'America/New_York' });
  try {
    const page = await context.newPage();
    const panel = await openMemberMilestones(page, session);
    await panel.getByRole('button', { name: '予定を追加', exact: true }).click();
    const form = panel.locator('.milestone-form');
    await expect(form).toContainText('America/New_York');
    await form.getByLabel('名前', { exact: true }).fill('DST gap');
    await form.getByLabel('日時', { exact: true }).fill('2030-03-10T02:30');
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('有効な日時を入力してください');
    await form.getByLabel('日時', { exact: true }).fill('2030-03-10T03:30');
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('予定を保存しました');
    const saved = (await milestoneRows(session)).find(({ title }) => title === 'DST gap');
    expect(canonicalInstant(saved?.plannedAt ?? '')).toBe('2030-03-10T07:30:00.000Z');
  } finally {
    await context.close();
  }
});
