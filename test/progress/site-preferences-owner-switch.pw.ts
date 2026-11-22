import { expect, test } from '@playwright/test';
import { PsqlSession, sql } from '../data/verify-concurrency';
import { createSessions, setRealSession } from './sessions';
import { expectSaved, openSitePreferences } from './site-preferences.helpers';

function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new Error(`Invalid real user id: ${value}`);
  return value;
}

function storedPreferences(userId: string) {
  return sql(
    `select coalesce(site_locale, '') || ':' || coalesce(site_theme, '') from public.dashboard_settings where user_id = '${uuid(userId)}'`,
  );
}

function blockingPid(holderPid: number) {
  return sql(`select pid from pg_stat_activity where ${holderPid}=any(pg_blocking_pids(pid)) limit 1`);
}

test('an old locked save cannot overwrite the next authenticated owner', async ({ browser }) => {
  const [firstSession, secondSession] = await createSessions();
  const context = await browser.newContext();
  let holder: PsqlSession | undefined;
  let holderFinished = false;
  try {
    const page = await context.newPage();
    await openSitePreferences(page, firstSession);
    await page.locator('#account-theme').selectOption('dark');
    await expectSaved(page);

    holder = new PsqlSession();
    holder.write(
      `begin; select pg_backend_pid(); select 1 from public.dashboard_settings where user_id = '${uuid(firstSession.userId)}' for update; select 'row-lock-acquired';`,
    );
    await holder.waitFor(/row-lock-acquired/);
    const holderPid = Number(holder.stdout.match(/^\d+\s*$/m)?.[0].trim());
    if (!Number.isInteger(holderPid) || holderPid <= 0)
      throw new Error('Lock holder did not return a PID.');

    const oldSave = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_site_preferences') && response.ok(),
    );
    await page.locator('#account-theme').selectOption('light');
    await expect.poll(() => blockingPid(holderPid)).toMatch(/^\d+$/);

    await setRealSession(page, secondSession);
    await expect(page.locator('#account-default-locale')).toHaveValue('');
    await expect(page.locator('#account-theme')).toHaveValue('system');
    await expect(page.locator('#account-theme')).toBeEnabled();

    holder.write('commit;');
    if ((await holder.finish()).status !== 0) throw new Error(`Lock holder failed: ${holder.stderr}`);
    holderFinished = true;
    await oldSave;
    await expect(page.locator('#account-default-locale')).toHaveValue('');
    await expect(page.locator('#account-theme')).toHaveValue('system');
    await expect(
      page.locator('[aria-labelledby="account-appearance-title"] [role="status"]'),
    ).toHaveCount(0);
    expect(storedPreferences(firstSession.userId)).toBe(':light');
    expect(
      sql(
        `select count(*) from public.dashboard_settings where user_id = '${uuid(secondSession.userId)}'`,
      ),
    ).toBe('0');
  } finally {
    if (holder && !holderFinished) {
      holder.write('rollback;');
      await holder.finish();
    }
    await context.close();
  }
});
