import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import type { VerifiedSession } from './session-proof';
import { gatewayOrigin, testKey } from './settings';

async function request(path: string, token: string, body?: object) {
  return fetch(`${gatewayOrigin}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      apikey: testKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function verifyRestRls(owner: VerifiedSession, other: VerifiedSession) {
  const initialized = await request('rpc/initialize_learning_state', owner.accessToken, {});
  expect(initialized.ok, await initialized.text()).toBe(true);
  const eventId = randomUUID();
  const saved = await request('rpc/append_learning_event', owner.accessToken, {
    p_expected_generation: 0,
    p_event: {
      event_id: eventId,
      schema_version: 1,
      certification_id: 'saa-c03',
      question_id: 'two-issuer-smoke',
      question_revision: 1,
      source_version: 'fixture-v1',
      category: 'security',
      mode: 'study',
      answered_at: '2026-01-01T15:00:00Z',
      selected: ['A'],
      correct: ['A'],
      is_correct: true,
      duration_ms: 10,
      attempt_number: 1,
      prior_incorrect_count: 0,
      reward: 1,
    },
  });
  expect(saved.ok, await saved.text()).toBe(true);
  const self = await request(`learning_events?event_id=eq.${eventId}`, owner.accessToken);
  expect(self.ok).toBe(true);
  const rows: { user_id: string; event_id: string }[] = await self.json();
  expect(rows.map((row) => [row.user_id, row.event_id])).toEqual([[owner.userId, eventId]]);
  const foreign = await request(`learning_events?event_id=eq.${eventId}`, other.accessToken);
  expect(foreign.ok).toBe(true);
  expect(await foreign.json()).toEqual([]);
  const direct = await request('learning_events', owner.accessToken, {
    user_id: owner.userId,
    event_id: randomUUID(),
  });
  expect(direct.ok).toBe(false);
  expect([401, 403]).toContain(direct.status);
  const anonymous = await request('rpc/initialize_learning_state', '', {});
  expect(anonymous.ok).toBe(false);
  expect([401, 403]).toContain(anonymous.status);
  return {
    eventId,
    selfRows: rows.length,
    otherRows: 0,
    directWrite: direct.status,
    anonymous: anonymous.status,
  };
}
