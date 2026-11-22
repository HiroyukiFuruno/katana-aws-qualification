import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { PsqlSession, sql } from '../data/verify-concurrency';
import { addMilestone, milestoneRow, milestoneRows, openMemberMilestones } from './milestones.helpers';
import { activeUserId, createSessions, setRealSession } from './sessions';

function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new Error(`Invalid real user id: ${value}`);
  return value;
}

function blockingPid(holderPid: number) {
  return sql(`select pid from pg_stat_activity where ${holderPid}=any(pg_blocking_pids(pid)) limit 1`);
}

test('a locked owner-A milestone save cannot surface after switching the real browser session to B', async ({
  browser,
}) => {
  const [first, second] = await createSessions();
  const context = await browser.newContext();
  let holder: PsqlSession | undefined;
  let holderFinished = false;
  try {
    const page = await context.newPage();
    const panel = await openMemberMilestones(page, first);
    await addMilestone(panel, 'ja', {
      kind: 'study',
      title: 'owner A original',
      plannedOn: '2030-08-01',
    });
    const row = milestoneRow(panel, 'owner A original');
    await row.getByRole('button', { name: '編集', exact: true }).click();
    const form = panel.locator('.milestone-form');
    await form.getByLabel('名前', { exact: true }).fill('owner A delayed');

    holder = new PsqlSession();
    holder.write(
      `begin; select pg_backend_pid(); select 1 from public.certification_milestones where user_id = '${uuid(first.userId)}' for update; select 'milestone-lock-acquired';`,
    );
    await holder.waitFor(/milestone-lock-acquired/);
    const holderPid = Number(holder.stdout.match(/^\d+\s*$/m)?.[0].trim());
    if (!Number.isInteger(holderPid) || holderPid <= 0)
      throw new Error('Milestone lock holder did not report a PID.');

    const delayed = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_certification_milestone') && response.ok(),
    );
    await form.getByRole('button', { name: '予定を保存', exact: true }).click();
    await expect.poll(() => blockingPid(holderPid)).toMatch(/^\d+$/);
    await setRealSession(page, second);
    await expect.poll(() => activeUserId(page)).toBe(second.userId);
    const tabs = page.getByRole('tablist', {
      name: messages.ja.dashboardSectionTabs,
      exact: true,
    });
    await expect(tabs).toBeVisible();
    await tabs.getByRole('tab', { name: messages.ja.dashboardSectionPlanning, exact: true }).click();
    const secondPanel = page.locator('.dashboard-widget-kind-milestones .milestones-panel');
    await expect(secondPanel).toHaveAttribute('aria-busy', 'false');
    await expect(secondPanel).not.toContainText('owner A delayed');
    expect(await milestoneRows(second)).toEqual([]);

    holder.write('commit;');
    if ((await holder.finish()).status !== 0)
      throw new Error(`Milestone lock holder failed: ${holder.stderr}`);
    holderFinished = true;
    await delayed;
    await expect(secondPanel.getByRole('status')).toHaveCount(0);
    await expect(secondPanel).not.toContainText('owner A delayed');
    expect((await milestoneRows(first)).map(({ title }) => title)).toContain('owner A delayed');
    expect(await milestoneRows(second)).toEqual([]);
  } finally {
    if (holder && !holderFinished) {
      holder.write('rollback;');
      await holder.finish();
    }
    await context.close();
  }
});
