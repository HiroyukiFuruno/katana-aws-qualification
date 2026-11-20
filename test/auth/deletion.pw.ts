import { expect, test } from '@playwright/test';
import { activeSession, setSession, signIn } from './deletion-helpers';
import { authOrigin, appOrigin, integrationProvider, testKey } from './settings';

const endpoint = `${authOrigin}/functions/v1/delete-account`;

test('the deletion endpoint rejects unauthenticated, cross-origin, and body-injection requests', async ({
  request,
}) => {
  const headers = { Origin: appOrigin, apikey: testKey('anon') };
  const unauthenticated = await request.post(endpoint, { headers });
  expect(unauthenticated.status()).toBe(401);

  const crossOrigin = await request.post(endpoint, {
    headers: { ...headers, Origin: 'https://attacker.example.test' },
  });
  expect(crossOrigin.status()).toBe(403);

  const bodyInjection = await request.post(endpoint, {
    data: { userId: 'other-account' },
    headers,
  });
  expect(bodyInjection.status()).toBe(400);
});

test('cancelling account deletion hides its confirmation', async ({ page }) => {
  await signIn(page, 'learner');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByRole('button', { name: 'アカウントを削除', exact: true }).click();
  const warning = page.getByText(
    'この操作は取り消せません。アカウントを完全に削除することを確認してください。',
    { exact: true },
  );
  await expect(warning).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(warning).toBeHidden();
});

test('a disposable real user can delete only the authenticated account through the UI', async ({
  page,
  browser,
  request,
}) => {
  await signIn(page, 'delete-account');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  const disposable = await activeSession(page);
  await page.getByRole('button', { name: 'アカウントを削除', exact: true }).click();
  const warning = page.getByText(
    'この操作は取り消せません。アカウントを完全に削除することを確認してください。',
    { exact: true },
  );
  await expect(warning).toBeVisible();
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await signIn(otherPage, 'other');
    const other = await activeSession(otherPage);
    await setSession(page, other);
    await expect(page.getByText('other@example.test', { exact: true })).toBeVisible();
    await expect(warning).toHaveCount(0);
    const mismatch = await page.evaluate(
      async ({ origin, key, provider, url, expectedAccountId }) => {
        const clientModule = '/src/auth/client.ts';
        const adapterModule = '/src/auth/SupabaseAuth.ts';
        const { createAuthClient } = await import(clientModule);
        const { SupabaseAuth } = await import(adapterModule);
        const auth = new SupabaseAuth(
          createAuthClient({ url: origin, key }),
          [provider],
          location.origin,
          {
            url,
            key,
          },
        );
        try {
          await auth.deleteAccount(expectedAccountId);
          return false;
        } catch (error) {
          return error instanceof Error && error.message === 'Account changed';
        }
      },
      {
        origin: authOrigin,
        key: testKey('anon'),
        provider: integrationProvider,
        url: endpoint,
        expectedAccountId: disposable.userId,
      },
    );
    expect(mismatch).toBe(true);
    const serviceHeaders = {
      apikey: testKey('service_role'),
      Authorization: `Bearer ${testKey('service_role')}`,
    };
    expect(
      (
        await request.get(`${authOrigin}/auth/v1/admin/users/${other.userId}`, {
          headers: serviceHeaders,
        })
      ).status(),
    ).toBe(200);
    await setSession(page, disposable);
    await expect(page.getByText('delete-account@example.test', { exact: true })).toBeVisible();
    await expect(warning).toHaveCount(0);
    await page.getByRole('button', { name: 'アカウントを削除', exact: true }).click();
    await page.getByRole('button', { name: 'アカウントを完全に削除', exact: true }).click();
    await expect(page).toHaveURL(/\/ja\/$/);
    await expect(page.getByRole('link', { name: '無料アカウントを作成' }).first()).toBeVisible();
    expect(
      (
        await request.get(`${authOrigin}/auth/v1/admin/users/${disposable.userId}`, {
          headers: serviceHeaders,
        })
      ).status(),
    ).toBe(404);
    await expect(otherPage.getByText('other@example.test', { exact: true })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
