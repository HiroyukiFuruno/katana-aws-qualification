import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request, type AuthSession } from './rest-client';
import {
  expectCode,
  expectInvalidDeleteRevision,
  milestone,
  rpc,
  save,
} from './verify-certification-milestones-contract';

export async function verifyCertificationMilestoneWrites(first: AuthSession) {
  const studyId = randomUUID();
  const study = save(studyId, { p_planned_at: '2027-06-02T10:00:00Z', p_planned_on: null });
  const savedStudy = await rpc(first, 'save_certification_milestone', study);
  milestone(savedStudy);
  assert.equal(savedStudy.plannedOn, null);
  await rpc(
    first,
    'save_certification_milestone',
    save(randomUUID(), {
      p_kind: 'mock_exam',
      p_title: 'Mock exam',
      p_planned_on: '2027-06-03',
      p_completed: true,
    }),
  );
  await rpc(
    first,
    'save_certification_milestone',
    save(randomUUID(), {
      p_kind: 'exam',
      p_title: 'Exam booking',
      p_planned_at: '2027-06-04T09:00:00Z',
      p_planned_on: null,
    }),
  );
  for (const [body, code, label] of [
    [
      save(randomUUID(), { p_kind: 'target', p_planned_at: '2027-06-05T09:00:00Z', p_completed: true }),
      '22023',
      'Invalid target fields',
    ],
    [
      save(randomUUID(), { p_certification_id: 'unknown-certification', p_planned_at: null }),
      '22023',
      'Unknown certification',
    ],
    [save(randomUUID(), { p_title: ' Title ', p_planned_at: null }), '22023', 'ASCII-space title'],
    [save(randomUUID(), { p_title: '\tTitle\t', p_planned_at: null }), '22023', 'Tab title'],
    [
      save(randomUUID(), { p_title: '\u3000Title\u3000', p_planned_at: null }),
      '22023',
      'Full-width-space title',
    ],
    [
      save(randomUUID(), { p_kind: 'target', p_title: 'Another target', p_planned_on: '2027-07-01' }),
      '23505',
      'Duplicate certification target',
    ],
    [save(randomUUID(), { p_expected_revision: -1 }), '22023', 'Negative new revision'],
    [save(randomUUID(), { p_expected_revision: 0 }), 'PT412', 'Missing update'],
  ] as const) {
    await expectCode(
      await request('/rpc/save_certification_milestone', {
        token: first.access_token,
        method: 'POST',
        body,
      }),
      code,
      label,
    );
  }
  await expectCode(
    await request('/rpc/save_certification_milestone', {
      token: first.access_token,
      method: 'POST',
      body: save(studyId, {
        p_title: 'Changed without revision',
        p_planned_at: '2027-06-02T10:00:00Z',
        p_planned_on: null,
      }),
    }),
    'PT412',
    'Changed retry',
  );
  const revised = await rpc(
    first,
    'save_certification_milestone',
    save(studyId, {
      p_title: 'Updated study',
      p_planned_at: '2027-06-02T10:00:00Z',
      p_planned_on: null,
      p_expected_revision: 0,
    }),
  );
  milestone(revised);
  assert.equal(revised.revision, 1);
  const writes = await Promise.all(
    ['First writer', 'Second writer'].map(async (title) => {
      const response = await request('/rpc/save_certification_milestone', {
        token: first.access_token,
        method: 'POST',
        body: save(studyId, {
          p_title: title,
          p_planned_at: '2027-06-02T10:00:00Z',
          p_planned_on: null,
          p_expected_revision: 1,
        }),
      });
      return { response, value: await response.json() };
    }),
  );
  assert.equal(
    writes.filter(({ response }) => response.ok).length,
    1,
    'Milestone CAS had multiple winners.',
  );
  const loser = writes.find(({ response }) => !response.ok);
  assert(loser, 'Milestone CAS had no stale loser.');
  assert.equal((loser.value as { code?: string }).code, 'PT412');
  for (const revision of [null, -1]) await expectInvalidDeleteRevision(first, revision);
  await expectCode(
    await request('/rpc/delete_certification_milestone', {
      token: first.access_token,
      method: 'POST',
      body: { p_id: studyId, p_expected_revision: 1, p_expected_generation: 0 },
    }),
    'PT412',
    'Stale milestone delete',
  );
  assert.equal(
    await rpc(first, 'delete_certification_milestone', {
      p_id: studyId,
      p_expected_revision: 2,
      p_expected_generation: 0,
    }),
    true,
  );
  assert.equal(
    await rpc(first, 'delete_certification_milestone', {
      p_id: studyId,
      p_expected_revision: 2,
      p_expected_generation: 0,
    }),
    true,
  );
}
