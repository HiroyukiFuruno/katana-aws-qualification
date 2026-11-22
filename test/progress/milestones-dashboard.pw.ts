import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { addMilestone, openMemberMilestones, openMilestoneEditor } from './milestones.helpers';
import { createSessions } from './sessions';

test('default planning widget is calendar-based and the settings picker restores a new table widget', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext({ timezoneId: 'America/New_York' });
  try {
    const page = await context.newPage();
    const panel = await openMemberMilestones(page, session);
    await expect(panel.locator('.milestone-calendar-grid tbody tr')).toHaveCount(6);
    await expect(panel.locator('.milestone-calendar-grid td')).toHaveCount(42);
    await addMilestone(panel, 'ja', {
      kind: 'study',
      title: 'カレンダーの予定',
      plannedAt: '2030-05-15T09:30',
    });
    await expect(panel.locator('.milestone-calendar')).toContainText('学習');

    const editor = await openMilestoneEditor(page);
    await editor.getByRole('button', { name: messages.ja.dashboardHideWidget, exact: true }).click();
    await expect(page.locator('.dashboard-widget-kind-milestones')).toHaveCount(0);
    const controls = page.locator('.dashboard-controls');
    const picker = controls.locator('details').filter({ hasText: messages.ja.dashboardAddWidget });
    await picker.locator('summary').click();
    await picker
      .getByRole('button', {
        name: `${messages.ja.dashboardAddWidget} ${messages.ja.dashboardMilestones}`,
        exact: true,
      })
      .click();
    await expect(page.locator('.dashboard-widget-kind-milestones')).toBeVisible();

    const restoredEditor = await openMilestoneEditor(page);
    await restoredEditor
      .getByRole('combobox', { name: messages.ja.dashboardChart, exact: true })
      .selectOption('table');
    await expect(panel.locator('.milestone-calendar')).toHaveCount(0);
    await expect(panel.locator('.milestone-agenda')).toContainText('カレンダーの予定');
    await controls.getByRole('button', { name: messages.ja.dashboardSave, exact: true }).click();
    await expect(controls.getByRole('status')).toContainText(messages.ja.dashboardSaved);
    await page.reload();
    const restoredPanel = await openMemberMilestones(page, session);
    await expect(restoredPanel.locator('.milestone-calendar')).toHaveCount(0);
    await expect(restoredPanel.locator('.milestone-agenda')).toContainText('カレンダーの予定');
  } finally {
    await context.close();
  }
});
