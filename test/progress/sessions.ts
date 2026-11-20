import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { fixtureKey, gatewayOrigin } from './settings';

export type RealSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

type SessionResponse = {
  access_token?: string;
  refresh_token?: string;
  session?: { access_token: string; refresh_token: string; user: { id: string } };
  user?: { id: string };
};

async function signUp(label: string): Promise<RealSession> {
  const response = await fetch(`${gatewayOrigin}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: fixtureKey('anon'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${label}-${randomUUID()}@example.test`,
      password: 'integration-password-123',
    }),
  });
  if (!response.ok) throw new Error(`GoTrue signup failed: ${response.status} ${await response.text()}`);
  const value = (await response.json()) as SessionResponse;
  if (value.session) {
    return {
      accessToken: value.session.access_token,
      refreshToken: value.session.refresh_token,
      userId: value.session.user.id,
    };
  }
  if (value.access_token && value.refresh_token && value.user) {
    return { accessToken: value.access_token, refreshToken: value.refresh_token, userId: value.user.id };
  }
  throw new Error('GoTrue signup response did not contain a session.');
}

export function createSessions() {
  return Promise.all([signUp('progress-user-a'), signUp('progress-user-b')]);
}

export async function setRealSession(page: Page, session: RealSession) {
  await page.evaluate(
    async ({ key, origin, value }) => {
      const { createAuthClient } = await import('/src/auth/client.ts');
      const { error } = await createAuthClient({ key, url: origin }).setSession({
        access_token: value.accessToken,
        refresh_token: value.refreshToken,
      });
      if (error) throw error;
    },
    { key: fixtureKey('anon'), origin: gatewayOrigin, value: session },
  );
  await page.waitForLoadState('domcontentloaded');
}

export async function activeUserId(page: Page) {
  try {
    return await page.evaluate(
      async ({ key, origin }) => {
        const { createAuthClient } = await import('/src/auth/client.ts');
        const { data, error } = await createAuthClient({ key, url: origin }).getUser();
        if (error || !data.user) throw error ?? new Error('Missing authenticated user.');
        return data.user.id;
      },
      { key: fixtureKey('anon'), origin: gatewayOrigin },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Execution context was destroyed'))
      return undefined;
    throw error;
  }
}
