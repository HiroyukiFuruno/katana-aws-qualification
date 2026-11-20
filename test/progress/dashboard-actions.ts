import { expect, type Page } from '@playwright/test';
import { titleKeys } from '../../src/dashboard/ui/dashboardLabels';
import { type DashboardDensity, dashboardSections } from '../../src/dashboard/ui/dashboardPresentation';
import type { Locale } from '../../src/locales';
import dashboardText from '../../src/locales/ja.json' with { type: 'json' };
import { messages } from '../../src/messages';

export async function showDashboardWidget(page: Page, title: string, locale: Locale = 'ja') {
  const text = messages[locale];
  const section = dashboardSections.find(({ kinds }) =>
    kinds.some((kind) => text[titleKeys[kind]] === title),
  );
  if (!section) throw new Error(`Dashboard section missing for ${title}`);
  const tabs = page.getByRole('tablist', { name: text.dashboardSectionTabs, exact: true });
  const tab = tabs.getByRole('tab', { name: text[section.label], exact: true });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  const panel = page.getByRole('tabpanel', { name: text[section.label], exact: true });
  const card = panel.locator('.dashboard-widget').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });
  if (!(await card.isVisible())) {
    await panel
      .getByRole('combobox', { name: text.dashboardSectionWidget, exact: true })
      .selectOption({ label: title });
  }
  await expect(card).toBeVisible();
  return card;
}

export async function openDashboardSettingsCategory(
  page: Page,
  category: 'dashboardSettingsDisplay' | 'dashboardSettingsFilters',
  level: 'dashboardSettingsBasic' | 'dashboardSettingsAdvanced',
) {
  const controls = page.locator('.dashboard-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator(':scope > summary').click();
  await controls.getByRole('button', { name: dashboardText[level] }).click();
  await controls.getByRole('tab', { name: dashboardText[category] }).click();
  return controls;
}

export async function setDashboardDensity(page: Page, density: DashboardDensity) {
  const settings = await openDashboardSettingsCategory(
    page,
    'dashboardSettingsDisplay',
    'dashboardSettingsBasic',
  );
  await settings.getByLabel(dashboardText.dashboardDensity).selectOption(density);
  await settings.locator(':scope > summary').click();
}

export function openDashboardAdvanced(page: Page) {
  return openDashboardSettingsCategory(page, 'dashboardSettingsFilters', 'dashboardSettingsAdvanced');
}

export async function openDashboardWidgetSettings(page: Page, title?: string) {
  const controls = await openDashboardSettingsCategory(
    page,
    'dashboardSettingsDisplay',
    'dashboardSettingsAdvanced',
  );
  if (title) {
    await controls
      .getByRole('combobox', { name: dashboardText.dashboardSectionWidget, exact: true })
      .selectOption({ label: title });
  }
  return controls.locator('.dashboard-widget-editor');
}
