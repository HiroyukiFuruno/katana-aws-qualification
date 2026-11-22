import { expect, test } from '@playwright/test';
import { addMilestone, milestoneRows, openMemberMilestones } from './milestones.helpers';
import { createSessions } from './sessions';

test('two real browser contexts require reload after target CAS conflict and keep ownership isolated', async ({
  browser,
}) => {
  const [firstSession, secondSession] = await createSessions();
  const firstContext = await browser.newContext();
  const staleContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const month = new Date().toISOString().slice(0, 7);
  try {
    const first = await firstContext.newPage();
    const stale = await staleContext.newPage();
    const [firstPanel, stalePanel] = await Promise.all([
      openMemberMilestones(first, firstSession),
      openMemberMilestones(stale, firstSession),
    ]);
    await addMilestone(firstPanel, 'ja', {
      kind: 'target',
      title: '競合する取得目標',
      plannedOn: `${month}-20`,
    });
    await stalePanel.getByRole('button', { name: '取得目標を追加', exact: true }).click();
    const form = stalePanel.locator('.milestone-form');
    await form.getByLabel('名前', { exact: true }).fill('古い取得目標');
    await form.getByLabel('日付', { exact: true }).fill(`${month}-21`);
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    const alert = stalePanel.getByRole('alert');
    await expect(alert).toContainText('別の場所で予定が変更されたか');
    await expect(form.getByLabel('名前', { exact: true })).toBeDisabled();
    await alert.getByRole('button', { name: 'クラウドの予定を再読み込み', exact: true }).click();
    await expect(stalePanel.getByRole('alert')).toHaveCount(0);
    await expect(stalePanel).toContainText('競合する取得目標');

    const other = await otherContext.newPage();
    const otherPanel = await openMemberMilestones(other, secondSession);
    await expect(otherPanel).not.toContainText('競合する取得目標');
    expect(await milestoneRows(secondSession)).toEqual([]);
  } finally {
    await Promise.all([firstContext.close(), staleContext.close(), otherContext.close()]);
  }
});

test('failed actual network save remains disabled until the member explicitly reloads', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const panel = await openMemberMilestones(page, session);
    await context.setOffline(true);
    await panel.getByRole('button', { name: '予定を追加', exact: true }).click();
    const form = panel.locator('.milestone-form');
    await form.getByLabel('名前', { exact: true }).fill('失敗する保存');
    await form.getByLabel('日時', { exact: true }).fill('2030-07-01T09:30');
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    const alert = panel.getByRole('alert');
    await expect(alert).toContainText('保存結果を確認できませんでした');
    await expect(form.getByLabel('名前', { exact: true })).toBeDisabled();
    await context.setOffline(false);
    await alert.getByRole('button', { name: 'クラウドの予定を再読み込み', exact: true }).click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(form.getByLabel('名前', { exact: true })).toBeEnabled();
    expect(await milestoneRows(session)).toEqual([]);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});
