import { expect, test } from '@playwright/test';
import { profileRows } from './api';
import { createSessions, setRealSession } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

const profileKey = 'katana.certification-profile.v1';

async function earnedRows(session: Awaited<ReturnType<typeof createSessions>>[number]) {
  const response = await fetch(
    `${gatewayOrigin}/rest/v1/earned_certifications?select=certification_id`,
    {
      headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${session.accessToken}` },
    },
  );
  if (!response.ok) throw new Error(`Earned certification read failed: ${response.status}`);
  return (await response.json()) as { certification_id: string }[];
}

test('profile import refreshes the active revision before the next assessment save', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: profileKey,
      value: JSON.stringify({ earned: ['saa-c03'], answers: {} }),
    });
    await page.goto('/ja/assessment/');
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect(page.getByText('取り込みを確認しました。')).toBeVisible();
    await expect.poll(() => profileRows(session)).toHaveLength(1);
    const [before] = await profileRows(session);
    if (!before) throw new Error('Imported roadmap profile was not found.');
    const saa = page.locator('.earned-directory label').filter({ hasText: 'SAA-C03' }).locator('input');
    await expect(saa).toBeChecked();
    const other = page
      .locator('.earned-directory label')
      .filter({ hasText: 'CLF-C02' })
      .locator('input');
    await expect(other).toBeVisible();
    await expect(other).not.toBeChecked();
    await other.click();
    await expect(other).toBeChecked();
    await expect
      .poll(() => profileRows(session))
      .toEqual([expect.objectContaining({ revision: before.revision + 1 })]);
    await expect
      .poll(() => earnedRows(session).then((rows) => rows.map((row) => row.certification_id).sort()))
      .toEqual(['clf-c02', 'saa-c03']);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
