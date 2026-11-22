import type { Page } from '@playwright/test';

const storageKey = 'kaq.account-merge-smoke.v1';

export function captureCallbackCode(page: Page) {
  let value: string | undefined;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) value ??= new URL(frame.url()).searchParams.get('code') ?? undefined;
  });
  return () => {
    if (!value) throw new Error('missing callback code');
    return value;
  };
}

export async function replayExchange(page: Page, legId: string, code: string) {
  const bearer = await page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return null;
    const token = (value as { access_token?: unknown }).access_token;
    return typeof token === 'string' ? token : null;
  }, storageKey);
  if (!bearer) throw new Error('missing main session');
  return page.evaluate(
    async ({ token, proofLegId, callbackCode }) => {
      const response = await fetch('http://127.0.0.1:54534/exchange', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ legId: proofLegId, code: callbackCode }),
      });
      return { status: response.status, body: await response.json() };
    },
    { token: bearer, proofLegId: legId, callbackCode: code },
  );
}
