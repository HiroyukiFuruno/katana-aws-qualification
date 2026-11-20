import { expect, test } from '@playwright/test';
import { profileRows } from './api';
import { createSessions, setRealSession } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

async function control(action: 'hold-next' | 'release') {
  const response = await fetch(`${gatewayOrigin}/test/${action}-profile-save`, { method: 'POST' });
  expect(response.ok).toBe(true);
}

async function earned(accessToken: string) {
  const response = await fetch(
    `${gatewayOrigin}/rest/v1/earned_certifications?select=certification_id`,
    {
      headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) throw new Error(`Profile read failed: ${response.status}`);
  const rows = (await response.json()) as { certification_id: string }[];
  return rows.map((row) => row.certification_id).sort();
}

test('profile edits wait for real save acknowledgment and keep both earned qualifications', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/assessment/');
    await setRealSession(page, session);
    await page.reload();
    const checkbox = (id: string) =>
      page.locator('.earned-directory label').filter({ hasText: id }).locator('input');
    const saa = checkbox('SAA-C03');
    const clf = checkbox('CLF-C02');
    await expect(saa).not.toBeChecked();
    await expect(clf).not.toBeChecked();
    const isSave = (response: import('@playwright/test').Response) =>
      response.url().includes('/rpc/replace_roadmap_profile');
    await control('hold-next');
    const saved = page.waitForResponse(isSave);
    await saa.click();
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
    await expect(saa).toBeDisabled();
    await expect(clf).toBeDisabled();
    await expect(page.getByRole('button', { name: /査定を始める/ })).toBeDisabled();
    await control('release');
    expect((await saved).ok()).toBe(true);
    await expect(saa).toBeChecked();
    await expect(clf).toBeEnabled();
    const [before] = await profileRows(session);
    if (!before) throw new Error('Saved profile not found');
    const second = page.waitForResponse(isSave);
    await clf.click();
    expect((await second).ok()).toBe(true);
    await expect(clf).toBeChecked();
    await expect
      .poll(() => profileRows(session))
      .toEqual([expect.objectContaining({ revision: before.revision + 1 })]);
    await expect.poll(() => earned(session.accessToken)).toEqual(['clf-c02', 'saa-c03']);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(saa).toBeChecked();
    await expect(clf).toBeChecked();
  } finally {
    await context.close();
  }
});
