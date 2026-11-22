import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { certifications } from '../../src/certifications';
import { readMilestone } from '../../src/milestones/codec';
import { createMilestonesRepository } from '../../src/milestones/repository';
import type { MilestoneInput } from '../../src/milestones/types';
import type { ProgressRpcClient } from '../../src/progress/types';
import { type AuthSession, createSessions, request } from './rest-client';

async function payload(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Real milestone client request failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function client(session: AuthSession): ProgressRpcClient {
  return {
    async rpc<T>(name: string, body: Record<string, unknown>) {
      return (await payload(
        await request(`/rpc/${name}`, { token: session.access_token, method: 'POST', body }),
      )) as T;
    },
    async select<T>(table: string, filters?: Record<string, string>) {
      return (await payload(
        await request(`/${table}?${new URLSearchParams(filters)}`, { token: session.access_token }),
      )) as T;
    },
  };
}

export async function verifyMilestoneClient() {
  const [first, second] = await createSessions();
  const firstClient = client(first);
  const secondClient = client(second);
  await firstClient.rpc('initialize_learning_state', {});
  await secondClient.rpc('initialize_learning_state', {});
  const repository = createMilestonesRepository(firstClient);
  const other = createMilestonesRepository(secondClient);
  const inputs: MilestoneInput[] = certifications.map(({ id }) => ({
    id: randomUUID(),
    certificationId: id,
    kind: 'study',
    title: 'Client contract',
    plannedOn: '2027-05-20',
    plannedAt: null,
    completed: false,
  }));
  for (const input of inputs)
    assert.deepEqual(await repository.save(input, null, 0), { ...input, revision: 0 });
  const rows = await repository.list(0);
  assert.deepEqual(
    rows.map(({ certificationId }) => certificationId).sort(),
    certifications.map(({ id }) => id).sort(),
  );
  assert.deepEqual(await other.list(0), []);
  const sameId = { ...inputs[0], title: 'Other owner' };
  await other.save(sameId, null, 0);
  const instant: MilestoneInput = {
    ...inputs[0],
    title: '🗡'.repeat(120),
    plannedOn: null,
    plannedAt: '2027-05-20T12:30:00.123456+09:00',
    completed: true,
  };
  const expected = { ...instant, plannedAt: '2027-05-20T03:30:00.123Z', revision: 1 };
  assert.deepEqual(await repository.save(instant, 0, 0), expected);
  const sqlPrecision = await firstClient.rpc('save_certification_milestone', {
    p_id: inputs[1].id,
    p_certification_id: inputs[1].certificationId,
    p_kind: 'study',
    p_title: 'SQL precision',
    p_planned_on: null,
    p_planned_at: '2027-05-20T03:30:00.123456Z',
    p_completed: false,
    p_expected_revision: 0,
    p_expected_generation: 0,
  });
  assert.equal(readMilestone(sqlPrecision).plannedAt, '2027-05-20T03:30:00.123Z');
  assert.deepEqual(await repository.save(instant, 0, 0), expected);
  await repository.remove(instant.id, 1, 0);
  await repository.remove(instant.id, 1, 0);
  await assert.rejects(
    repository.save(instant, null, 0),
    /PT412/,
    'Deleted create retry must stay rejected.',
  );
  assert.deepEqual(await other.list(0), [{ ...sameId, revision: 0 }]);
  assert.equal((await repository.list(0)).length, certifications.length - 1);
  assert.deepEqual(await firstClient.select('learning_events'), []);
  console.log(
    'Real milestone client: all catalog IDs, UTC, Unicode, retry, delete and owner isolation.',
  );
}
