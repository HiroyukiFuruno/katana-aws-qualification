import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { canonicalInstant } from '../../src/milestones/dates';
import {
  addMilestone,
  milestoneRow,
  milestoneRows,
  openMemberMilestones,
  openMilestoneEditor,
} from './milestones.helpers';
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

test('editing a later New York overlap preserves the UTC instant created in a UTC browser', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const utc = await browser.newContext({ timezoneId: 'UTC' });
  const newYork = await browser.newContext({ timezoneId: 'America/New_York' });
  try {
    const utcPage = await utc.newPage();
    const utcPanel = await openMemberMilestones(utcPage, session);
    await addMilestone(utcPanel, 'ja', {
      kind: 'study',
      title: 'later overlap source',
      plannedAt: '2030-11-03T06:30',
    });
    const editor = await openMilestoneEditor(utcPage);
    await editor
      .getByRole('combobox', { name: messages.ja.dashboardChart, exact: true })
      .selectOption('table');
    const controls = utcPage.locator('.dashboard-controls');
    await controls.getByRole('button', { name: messages.ja.dashboardSave, exact: true }).click();
    await expect(controls.getByRole('status')).toContainText(messages.ja.dashboardSaved);

    const newYorkPage = await newYork.newPage();
    const newYorkPanel = await openMemberMilestones(newYorkPage, session);
    const original = milestoneRow(newYorkPanel, 'later overlap source');
    await original.getByRole('button', { name: '編集', exact: true }).click();
    const form = newYorkPanel.locator('.milestone-form');
    await expect(form.getByLabel('日時', { exact: true })).toHaveValue('2030-11-03T01:30');
    await form.getByLabel('名前', { exact: true }).fill('later overlap renamed');
    await form.getByLabel('完了（自己申告）', { exact: true }).check();
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect(newYorkPanel.getByRole('status')).toContainText('予定を保存しました');
    let stored = (await milestoneRows(session)).find(({ title }) => title === 'later overlap renamed');
    expect(canonicalInstant(stored?.plannedAt ?? '')).toBe('2030-11-03T06:30:00.000Z');

    await milestoneRow(newYorkPanel, 'later overlap renamed')
      .getByRole('button', { name: '編集', exact: true })
      .click();
    await form.getByLabel('完了（自己申告）', { exact: true }).uncheck();
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect(newYorkPanel.getByRole('status')).toContainText('予定を保存しました');
    stored = (await milestoneRows(session)).find(({ title }) => title === 'later overlap renamed');
    expect(stored?.completed).toBe(false);
    expect(canonicalInstant(stored?.plannedAt ?? '')).toBe('2030-11-03T06:30:00.000Z');
  } finally {
    await Promise.all([utc.close(), newYork.close()]);
  }
});
