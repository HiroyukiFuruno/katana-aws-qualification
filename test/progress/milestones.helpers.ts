import { expect, type Locator, type Page } from '@playwright/test';
import { type Locale, localePath } from '../../src/locales';
import { messages } from '../../src/messages';
import type { Milestone, MilestoneKind } from '../../src/milestones/types';
import { type RealSession, setRealSession } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

export type MilestoneDraft = {
  certificationId?: string;
  completed?: boolean;
  kind: MilestoneKind;
  plannedAt?: string;
  plannedOn?: string;
  title: string;
};

export async function openMemberMilestones(page: Page, session: RealSession, locale: Locale = 'ja') {
  const text = messages[locale];
  await page.goto(localePath(locale, 'dashboard'));
  await setRealSession(page, session);
  await page.reload();
  const necessary = page.getByRole('button', { name: text.cookieNecessary, exact: true });
  if (await necessary.isVisible()) await necessary.click();
  const tabs = page.getByRole('tablist', { name: text.dashboardSectionTabs, exact: true });
  const planning = tabs.getByRole('tab', { name: text.dashboardSectionPlanning, exact: true });
  if ((await planning.getAttribute('aria-selected')) !== 'true') await planning.click();
  const panel = page.locator('.dashboard-widget-kind-milestones .milestones-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  return panel;
}

export async function addMilestone(panel: Locator, locale: Locale, draft: MilestoneDraft) {
  const text = messages[locale];
  await panel
    .getByRole('button', {
      name: draft.kind === 'target' ? text.milestoneAddTarget : text.milestoneAddSchedule,
      exact: true,
    })
    .click();
  const form = panel.locator('.milestone-form');
  await expect(form).toBeVisible();
  await form.getByLabel(text.milestoneTitleLabel, { exact: true }).fill(draft.title);
  if (draft.certificationId)
    await form
      .getByRole('combobox', { name: text.milestoneCertification, exact: true })
      .selectOption(draft.certificationId);
  if (draft.kind !== 'target')
    await form.getByRole('combobox', { name: text.milestoneKind, exact: true }).selectOption(draft.kind);
  if (draft.plannedOn) {
    const allDay = form.getByLabel(text.milestoneAllDay, { exact: true });
    if (draft.kind !== 'target' && !(await allDay.isChecked())) await allDay.check();
    await form.getByLabel(text.milestoneDate, { exact: true }).fill(draft.plannedOn);
  } else if (draft.plannedAt)
    await form.getByLabel(text.milestoneDateTime, { exact: true }).fill(draft.plannedAt);
  if (draft.completed) await form.getByLabel(text.milestoneCompleted, { exact: true }).check();
  await form.getByRole('button', { name: text.milestoneSave, exact: true }).click();
  await expect(panel.getByRole('status')).toContainText(text.milestoneSaved);
}

export async function openMilestoneEditor(page: Page, locale: Locale = 'ja') {
  const text = messages[locale];
  const controls = page.locator('.dashboard-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator(':scope > summary').click();
  await controls.getByRole('button', { name: text.dashboardSettingsAdvanced, exact: true }).click();
  await controls.getByRole('tab', { name: text.dashboardSettingsDisplay, exact: true }).click();
  await controls
    .getByRole('combobox', { name: text.dashboardSectionWidget, exact: true })
    .selectOption({ label: text.dashboardMilestones });
  return controls.locator('.dashboard-widget-editor');
}

export async function deleteMilestone(panel: Locator, locale: Locale, title: string) {
  const text = messages[locale];
  const row = panel.locator('.milestone-row').filter({ hasText: title });
  await expect(row).toBeVisible();
  const accepted = new Promise<void>((resolve, reject) => {
    panel.page().once('dialog', (dialog) => void dialog.accept().then(resolve, reject));
  });
  await row.getByRole('button', { name: text.milestoneDelete, exact: true }).click();
  await accepted;
  await expect(row).toHaveCount(0);
}

export function milestoneRow(panel: Locator, title: string) {
  return panel.locator('.milestone-row').filter({ hasText: title });
}

export async function milestoneRows(session: RealSession): Promise<Milestone[]> {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/list_certification_milestones`, {
    method: 'POST',
    headers: {
      apikey: fixtureKey('anon'),
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_expected_generation: 0 }),
  });
  if (!response.ok)
    throw new Error(`Milestone PostgREST list failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as Milestone[];
}

export async function expectNoHorizontalOverflow(page: Page, width: number) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width);
}
