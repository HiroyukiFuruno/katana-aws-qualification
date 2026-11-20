import { expect, test } from '@playwright/test';
import { fixtureKey, gatewayOrigin } from './settings';
import { createSessions, setRealSession, type RealSession } from './sessions';
import { historyKey, items, learningEvents, manifests, validAttempt } from './migration-history.helpers';

type EventRow = {
  event_id: string;
  question_id: string;
  question_revision: number;
  answered_at: string;
  selected: string[];
  is_correct: boolean;
  attempt_number: number;
  prior_incorrect_count: number;
};

async function eventRows(session: RealSession) {
  const response = await fetch(
    `${gatewayOrigin}/rest/v1/learning_events?select=event_id,question_id,question_revision,answered_at,selected,is_correct,attempt_number,prior_incorrect_count&order=answered_at.asc`,
    { headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${session.accessToken}` } },
  );
  if (!response.ok) throw new Error(`PostgREST read failed: ${response.status}`);
  return (await response.json()) as EventRow[];
}

test('history re-import keeps prior IDs and payloads after source rewrites', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const corrupt = { malformed: true };
    const initialRaw = JSON.stringify([validAttempt, corrupt]);
    await page.goto('/ja/study/saa-c03/');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: historyKey,
      value: initialRaw,
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect(page.getByRole('button', { name: '自分の記録を取り込む' })).toBeVisible();
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect.poll(() => learningEvents(session)).toHaveLength(1);
    await expect.poll(() => manifests(session)).toHaveLength(1);
    const [firstManifest] = await manifests(session);
    await expect
      .poll(() => items(session, firstManifest.manifest_id))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source_row_id: 'history-0', outcome: 'accepted' }),
          expect.objectContaining({ source_row_id: 'corrupt-0', outcome: 'rejected' }),
        ]),
      );
    const [firstEvent] = await eventRows(session);
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBe(
      initialRaw,
    );

    const secondAttempt = {
      ...validAttempt,
      answeredAt: '2026-11-20T01:00:00+00:00',
      attemptNumber: 2,
    };
    const reordered = Object.fromEntries(Object.entries(validAttempt).reverse());
    const rewrittenRaw = JSON.stringify([reordered, secondAttempt, corrupt]);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: historyKey,
      value: rewrittenRaw,
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect.poll(() => eventRows(session)).toHaveLength(2);
    await expect.poll(() => manifests(session)).toHaveLength(2);
    const secondEvents = await eventRows(session);
    expect(secondEvents.find((event) => event.event_id === firstEvent.event_id)).toEqual(firstEvent);
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBe(
      rewrittenRaw,
    );

    const reformattedRaw = JSON.stringify([reordered, secondAttempt, corrupt], null, 2);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: historyKey,
      value: reformattedRaw,
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect.poll(() => eventRows(session)).toHaveLength(2);
    await expect.poll(() => manifests(session)).toHaveLength(3);
    expect(await eventRows(session)).toEqual(secondEvents);
    await expect(page.evaluate((key) => localStorage.getItem(key), historyKey)).resolves.toBe(
      reformattedRaw,
    );
  } finally {
    await context.close();
  }
});
