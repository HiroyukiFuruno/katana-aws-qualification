import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request, type AuthSession } from './rest-client';
import { expectCode, list, milestone, rpc, save } from './verify-certification-milestones-contract';

export async function verifyCertificationMilestoneOwnership(first: AuthSession, second: AuthSession) {
  const targetId = randomUUID();
  const target = save(targetId, {
    p_kind: 'target',
    p_title: 'Solutions Architect goal',
    p_planned_on: '2027-06-01',
    p_completed: false,
  });
  const saved = await rpc(first, 'save_certification_milestone', target);
  milestone(saved);
  assert.equal(saved.revision, 0);
  assert.equal(saved.plannedAt, null);
  assert.deepEqual(await rpc(first, 'save_certification_milestone', target), saved);
  await expectCode(
    await request('/rpc/save_certification_milestone', { method: 'POST', body: target }),
    '42501',
    'Anonymous milestone save',
  );
  const direct = await request('/certification_milestones', {
    token: first.access_token,
    method: 'POST',
    body: { user_id: first.user.id, id: randomUUID(), certification_id: 'saa-c03' },
  });
  assert.equal(direct.ok, false, 'PostgREST allowed direct milestone writes.');
  assert.deepEqual(await list(second, 0), []);
  assert.equal(
    await rpc(second, 'delete_certification_milestone', {
      p_id: targetId,
      p_expected_revision: 0,
      p_expected_generation: 0,
    }),
    true,
  );
  assert.equal((await list(first, 0)).length, 1, 'Another user deleted an owned milestone.');
  return targetId;
}
