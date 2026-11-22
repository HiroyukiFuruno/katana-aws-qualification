import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request, type AuthSession } from './rest-client';

export type Milestone = {
  id: string;
  certificationId: string;
  kind: string;
  title: string;
  plannedOn: string | null;
  plannedAt: string | null;
  completed: boolean;
  revision: number;
};

const keys = [
  'certificationId',
  'completed',
  'id',
  'kind',
  'plannedAt',
  'plannedOn',
  'revision',
  'title',
];

export async function rpc(session: AuthSession, name: string, body: object): Promise<unknown> {
  const response = await request(`/rpc/${name}`, { token: session.access_token, method: 'POST', body });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Milestone RPC ${name} failed: ${response.status} ${JSON.stringify(value)}`);
  return value;
}

export async function expectCode(response: Response, code: string, label: string) {
  const value = (await response.json()) as { code?: string };
  assert.equal(response.ok, false, `${label} unexpectedly succeeded`);
  assert.equal(value.code, code, `${label} returned the wrong error`);
}

export async function expectInvalidDeleteRevision(session: AuthSession, revision: number | null) {
  await expectCode(
    await request('/rpc/delete_certification_milestone', {
      token: session.access_token,
      method: 'POST',
      body: { p_id: randomUUID(), p_expected_revision: revision, p_expected_generation: 0 },
    }),
    '22023',
    'Invalid delete revision',
  );
}

export function milestone(value: unknown): asserts value is Milestone {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    'Milestone RPC returned a non-object.',
  );
  assert.deepEqual(Object.keys(value).sort(), keys, 'Milestone RPC leaked or omitted fields.');
  const item = value as Milestone;
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.certificationId, 'string');
  assert.equal(typeof item.kind, 'string');
  assert.equal(typeof item.title, 'string');
  assert.equal(item.plannedOn === null || typeof item.plannedOn === 'string', true);
  assert.equal(item.plannedAt === null || typeof item.plannedAt === 'string', true);
  assert.equal(typeof item.completed, 'boolean');
  assert.equal(typeof item.revision, 'number');
}

export async function list(session: AuthSession, generation: number) {
  const value = await rpc(session, 'list_certification_milestones', {
    p_expected_generation: generation,
  });
  assert(Array.isArray(value), 'Milestone list did not return an array.');
  value.forEach(milestone);
  return value;
}

export function save(id: string, overrides: Record<string, unknown> = {}) {
  return {
    p_id: id,
    p_certification_id: 'saa-c03',
    p_kind: 'study',
    p_title: 'Architecture study',
    p_planned_on: '2027-06-02',
    p_planned_at: null,
    p_completed: false,
    p_expected_revision: null,
    p_expected_generation: 0,
    ...overrides,
  };
}
