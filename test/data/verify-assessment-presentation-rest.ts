import assert from 'node:assert/strict';
import { filterAssessmentProfile } from '../../src/assessmentOptionOrder';
import type { Profile } from '../../src/progress/profileTypes';
import { createSessions, request, type AuthSession } from './rest-client';

type Snapshot = {
  earned: string[];
  answers: Record<string, number>;
  presentation: { optionOrders: Record<string, number[]>; order: string[] };
  revision: number;
};

async function json(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Assessment REST request failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function snapshot(session: AuthSession): Promise<Snapshot> {
  const body = await json(
    await request('/rpc/load_roadmap_profile_snapshot_v2', {
      token: session.access_token,
      method: 'POST',
      body: {},
    }),
  );
  if (!Array.isArray(body) || body.length !== 1 || typeof body[0] !== 'object' || body[0] === null) {
    throw new Error(`Unexpected assessment snapshot response: ${JSON.stringify(body)}`);
  }
  return body[0] as Snapshot;
}

export async function verifyAssessmentPresentationPostgrest() {
  const [session] = await createSessions();
  await json(
    await request('/rpc/initialize_learning_state', {
      token: session.access_token,
      method: 'POST',
      body: {},
    }),
  );
  const initial: Profile = {
    earned: ['old-cert'],
    answers: { removed: 1, retained: 2 },
    optionOrders: { removed: [3, 2, 1, 0], retained: [2, 0, 3, 1] },
    order: ['removed', 'retained'],
  };
  await json(
    await request('/rpc/replace_roadmap_profile_v2', {
      token: session.access_token,
      method: 'POST',
      body: {
        p_earned: initial.earned,
        p_answers: initial.answers,
        p_expected_generation: 0,
        p_expected_revision: 0,
        p_presentation: { optionOrders: initial.optionOrders, order: initial.order },
      },
    }),
  );
  const filtered = filterAssessmentProfile(initial, ['new-cert'], new Set(['retained', 'added']));
  const beforeInvalid = await snapshot(session);
  const invalid = await request('/rpc/replace_roadmap_profile_v2', {
    token: session.access_token,
    method: 'POST',
    body: {
      p_earned: filtered.earned,
      p_answers: filtered.answers,
      p_expected_generation: 0,
      p_expected_revision: beforeInvalid.revision,
      p_presentation: { optionOrders: filtered.optionOrders, order: [] },
    },
  });
  assert.equal(invalid.ok, false);
  const afterInvalid = await snapshot(session);
  assert.equal(afterInvalid.revision, beforeInvalid.revision);
  await json(
    await request('/rpc/replace_roadmap_profile_v2', {
      token: session.access_token,
      method: 'POST',
      body: {
        p_earned: filtered.earned,
        p_answers: filtered.answers,
        p_expected_generation: 0,
        p_expected_revision: beforeInvalid.revision,
        p_presentation: { optionOrders: filtered.optionOrders, order: filtered.order },
      },
    }),
  );
  const saved = await snapshot(session);
  assert.equal(saved.revision, beforeInvalid.revision + 1);
  assert.deepEqual(saved.earned, ['new-cert']);
  assert.deepEqual(saved.answers, { retained: 2 });
  assert.deepEqual(saved.presentation, {
    optionOrders: { retained: [2, 0, 3, 1] },
    order: ['retained'],
  });
  assert(!Object.hasOwn(saved.answers, 'removed'));
  assert(!saved.presentation.order.includes('removed'));
}
