import { writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { sql } from './commands';
import { verifyFoundation } from './foundation-proof';
import { verifyRestRls } from './rest-proof';
import { type VerifiedSession, verifySession } from './session-proof';
import { artifacts } from './settings';

async function login(page: Page, label: string): Promise<VerifiedSession> {
  await page.goto('/test/account-merge/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByLabel('Username or email').fill('learner');
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('authenticated');
  return page.evaluate(async () => {
    const modulePath = '/test/account-merge/browser.ts';
    const module = await import(modulePath);
    return module.verifiedSession();
  });
}

test('two real OIDC issuers share one GoTrue database with live OAuth sessions and isolated REST owners', async ({
  browser,
}) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await login(await firstContext.newPage(), 'First issuer');
    const second = await login(await secondContext.newPage(), 'Second issuer');
    expect(first.userId).not.toBe(second.userId);
    const firstProof = verifySession(first, 'first', 'keycloak');
    const secondProof = verifySession(second, 'second', 'azure');
    expect(firstProof.sessionId).not.toBe(secondProof.sessionId);
    const ownFirst = await verifyRestRls(first, second);
    const ownSecond = await verifyRestRls(second, first);
    expect(sql('select count(*) from auth.users')).toBe('2');
    expect(sql("select rolbypassrls from pg_roles where rolname = 'service_role'")).toBe('t');
    const foundation = await verifyFoundation(
      first,
      second,
      firstProof.sessionId,
      secondProof.sessionId,
    );
    const proof = {
      status: 'passed',
      observedAt: new Date().toISOString(),
      database: 'kaq_account_merge',
      issuers: [firstProof, secondProof],
      rls: [ownFirst, ownSecond],
      foundation,
    };
    writeFileSync(`${artifacts}/smoke-proof.json`, `${JSON.stringify(proof, null, 2)}\n`);
    console.log(JSON.stringify(proof));
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
