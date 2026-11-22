import { expect, test } from '@playwright/test';
import { localePath } from '../../src/locales';
import { messages } from '../../src/messages';
import { learningEvents } from './api';
import { showDashboardWidget } from './dashboard-actions';
import {
  addMilestone,
  deleteMilestone,
  milestoneRow,
  milestoneRows,
  openMemberMilestones,
} from './milestones.helpers';
import { createSessions } from './sessions';

test('member creates, edits, deletes, and restores all four milestone kinds without adding learning results', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const first = await browser.newContext();
  const second = await browser.newContext();
  const month = new Date().toISOString().slice(0, 7);
  try {
    const page = await first.newPage();
    const panel = await openMemberMilestones(page, session);
    await addMilestone(panel, 'ja', {
      kind: 'target',
      title: 'SAA 取得目標',
      plannedOn: `${month}-20`,
    });
    await addMilestone(panel, 'ja', {
      kind: 'study',
      title: '学習計画',
      plannedOn: `${month}-15`,
      completed: true,
      certificationId: 'saa-c03',
    });
    await addMilestone(panel, 'ja', {
      kind: 'mock_exam',
      title: '模試計画',
      plannedAt: `${month}-16T19:30`,
      certificationId: 'saa-c03',
    });
    await addMilestone(panel, 'ja', {
      kind: 'exam',
      title: '本番計画',
      plannedOn: `${month}-18`,
      certificationId: 'saa-c03',
    });
    await expect(panel.locator('.milestone-row')).toHaveCount(4);
    await expect(
      milestoneRow(panel, '学習計画').getByRole('link', { name: messages.ja.study, exact: true }),
    ).toHaveAttribute('href', localePath('ja', 'study/saa-c03'));
    await expect(
      milestoneRow(panel, '模試計画').getByRole('link', { name: messages.ja.exam, exact: true }),
    ).toHaveAttribute('href', `${localePath('ja', 'study/saa-c03')}?mode=exam`);
    await expect(
      milestoneRow(panel, '本番計画').getByRole('link', { name: messages.ja.certGuides, exact: true }),
    ).toHaveAttribute('href', localePath('ja', 'certifications/saa-c03'));
    await expect(page.locator('footer a[href="/ja/assessment/"]')).toBeVisible();
    expect((await milestoneRows(session)).find(({ title }) => title === '学習計画')?.completed).toBe(
      true,
    );
    expect(await learningEvents(session)).toEqual([]);
    const overview = await showDashboardWidget(page, '概要');
    await expect(
      overview.locator('.dashboard-viz-metric').filter({ hasText: '回答数' }).locator('strong'),
    ).toHaveText('0');

    await page.getByRole('tab', { name: '学習の予定', exact: true }).click();
    const row = milestoneRow(panel, '模試計画');
    const edit = row.getByRole('button', { name: '編集', exact: true });
    await edit.focus();
    await page.keyboard.press('Enter');
    const form = panel.locator('.milestone-form');
    await form.getByLabel('名前', { exact: true }).fill('模試計画（更新）');
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect(milestoneRow(panel, '模試計画（更新）')).toBeVisible();
    await deleteMilestone(panel, 'ja', '本番計画');
    await expect(panel.locator('.milestone-row')).toHaveCount(3);

    const restored = await second.newPage();
    const restoredPanel = await openMemberMilestones(restored, session);
    await expect(restoredPanel).toContainText('SAA 取得目標');
    await expect(restoredPanel).toContainText('学習計画');
    await expect(restoredPanel).toContainText('模試計画（更新）');
    await expect(restoredPanel).not.toContainText('本番計画');
    expect((await milestoneRows(session)).map(({ kind }) => kind).sort()).toEqual([
      'mock_exam',
      'study',
      'target',
    ]);
    expect(await learningEvents(session)).toEqual([]);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});
