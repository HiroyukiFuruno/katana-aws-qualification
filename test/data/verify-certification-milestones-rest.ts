import assert from 'node:assert/strict';
import { createSessions, request } from './rest-client';
import { verifyCertificationMilestoneConcurrency } from './verify-certification-milestones-concurrency';
import { expectCode, list, rpc } from './verify-certification-milestones-contract';
import { verifyCertificationMilestoneOwnership } from './verify-certification-milestones-ownership';
import { verifyCertificationMilestoneWrites } from './verify-certification-milestones-writes';

export async function verifyCertificationMilestonesPostgrest() {
  const [first, second] = await createSessions();
  await rpc(first, 'initialize_learning_state', {});
  await rpc(second, 'initialize_learning_state', {});
  assert.deepEqual(await list(first, 0), []);
  await verifyCertificationMilestoneConcurrency(first);
  const targetId = await verifyCertificationMilestoneOwnership(first, second);
  await verifyCertificationMilestoneWrites(first);
  const learningEvents = await request('/learning_events', { token: first.access_token });
  assert.deepEqual(await learningEvents.json(), [], 'Completed milestones entered learning results.');
  await rpc(first, 'reset_my_learning_data', { p_expected_generation: 0 });
  assert.equal(
    (await list(first, 1)).some(({ id }) => id === targetId),
    true,
    'Learning reset removed milestones.',
  );
  await expectCode(
    await request('/rpc/list_certification_milestones', {
      token: first.access_token,
      method: 'POST',
      body: { p_expected_generation: 0 },
    }),
    'PT409',
    'Stale milestone generation',
  );
  console.log(
    'Certification milestones PostgREST: ownership, validation, retry, CAS, reset retention verified.',
  );
}
