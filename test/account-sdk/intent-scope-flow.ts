import { type BrowserContext, expect, type Page } from '@playwright/test';
import { authenticate } from './flow';
import { readScopeIntentVersion } from './intent-scope-http';
import type { startSdkAdapter } from './server';

export async function proveScopeOwners(
  page: Page,
  adapter: Awaited<ReturnType<typeof startSdkAdapter>>,
) {
  await authenticate(page, 'source', 'awaiting_target');
  // callback画面には次の認証ボタンがないため、元sessionを保持して操作画面へ戻る。
  await page.goto('/test/account-sdk/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  const proof = await authenticate(page, 'target', 'both_proved');
  const { intent, sourceScope } = adapter.intent();
  const revision = await readScopeIntentVersion(page, intent.id, intent.secret, sourceScope);
  return { ...proof, revision };
}

export async function closeScopeContext(context: BrowserContext, adapter: { close(): Promise<void> }) {
  try {
    await context.close();
  } finally {
    await adapter.close();
  }
}
