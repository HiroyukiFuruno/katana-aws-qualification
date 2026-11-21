import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { artifacts } from '../account-merge/settings';

export function observeSdkPage(page: Page, receiptFilename = 'sdk-flow-observations.json') {
  const publicBodies: string[] = [];
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const requestUrls: string[] = [];
  const thirdPartyScripts: string[] = [];
  const analyticsRequests: string[] = [];
  const signals: object[] = [];
  function address(value: string) {
    const url = new URL(value);
    return { origin: url.origin, path: url.pathname, queryKeys: [...url.searchParams.keys()] };
  }
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) signals.push({ event: 'navigation', ...address(frame.url()) });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.name);
    signals.push({ event: 'pageerror', type: error.name });
  });
  page.on('console', (message) => consoleMessages.push(message.text()));
  page.on('request', (request) => {
    requestUrls.push(request.url());
    const url = new URL(request.url());
    if (/(?:google-analytics|googletagmanager|googlesyndication|doubleclick)\./.test(url.hostname))
      analyticsRequests.push(url.origin);
    if (
      page.url().includes('/test/account-sdk/callback.html') &&
      request.resourceType() === 'script' &&
      url.origin !== 'http://127.0.0.1:54533'
    )
      thirdPartyScripts.push(url.origin);
  });
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.origin !== 'http://127.0.0.1:54534') return;
    signals.push({ event: 'response', status: response.status(), ...address(response.url()) });
    if (response.request().method() !== 'POST') return;
    try {
      const raw = await response.text();
      publicBodies.push(raw);
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object') {
        const reply = value as Record<string, unknown>;
        signals.push({
          event: 'reply',
          path: url.pathname,
          fields: Object.keys(reply),
          state: typeof reply.state === 'string' ? reply.state : null,
          failure: typeof reply.failure === 'string' ? reply.failure : null,
          authorization:
            typeof reply.authorizationUrl === 'string' ? address(reply.authorizationUrl) : null,
        });
      }
    } catch {
      signals.push({ event: 'body_unavailable', path: url.pathname });
    }
  });
  return {
    publicBodies,
    consoleMessages,
    pageErrors,
    requestUrls,
    thirdPartyScripts,
    analyticsRequests,
    write() {
      writeFileSync(
        `${artifacts}/${receiptFilename}`,
        `${JSON.stringify({ observedAt: new Date().toISOString(), signals }, null, 2)}\n`,
      );
    },
  };
}
