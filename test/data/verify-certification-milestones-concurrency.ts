import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type AuthSession, request } from './rest-client';
import { expectCode, list, save } from './verify-certification-milestones-contract';
import { PsqlSession, sql } from './verify-concurrency';

async function saveResponse(session: AuthSession, id: string) {
  return request('/rpc/save_certification_milestone', {
    token: session.access_token,
    method: 'POST',
    body: save(id),
  });
}

async function assertHiddenAndRejected(session: AuthSession, id: string) {
  assert.equal(
    (await list(session, 0)).some((item) => item.id === id),
    false,
    'Deleted marker appeared in list.',
  );
  const direct = await request(`/certification_milestones?id=eq.${id}`, { token: session.access_token });
  assert.equal(direct.ok, true, 'Milestone marker read failed.');
  assert.deepEqual(await direct.json(), [], 'Deleted marker was visible through PostgREST.');
  await expectCode(await saveResponse(session, id), 'PT412', 'Deleted create retry');
}

async function verifyUnknownDeleteRace(session: AuthSession) {
  const id = randomUUID();
  const [deleted, created] = await Promise.allSettled([
    request('/rpc/delete_certification_milestone', {
      token: session.access_token,
      method: 'POST',
      body: { p_id: id, p_expected_revision: 0, p_expected_generation: 0 },
    }),
    saveResponse(session, id),
  ]);
  assert.equal(deleted.status, 'fulfilled', 'Concurrent delete did not reach PostgREST.');
  assert.equal(created.status, 'fulfilled', 'Concurrent create did not reach PostgREST.');
  if (deleted.status !== 'fulfilled' || created.status !== 'fulfilled') return;
  assert.equal(deleted.value.ok, true, 'Concurrent delete was rejected.');
  assert.equal(await deleted.value.json(), true, 'Concurrent delete did not return true.');
  if (!created.value.ok) await expectCode(created.value, 'PT412', 'Concurrent create');
  await assertHiddenAndRejected(session, id);
}

async function waitForBlocked(holderPid: number) {
  const deadline = Date.now() + 10_000;
  while (
    sql(
      `select exists (select 1 from pg_stat_activity activity where ${holderPid} = any(pg_blocking_pids(activity.pid)))`,
    ) !== 't'
  ) {
    if (Date.now() >= deadline) throw new Error('PostgREST did not wait on the marker insert.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function verifyInsertConflictFallback(session: AuthSession) {
  const id = randomUUID();
  const holder = new PsqlSession();
  let finished = false;
  let pending: Promise<Response> | undefined;
  try {
    holder.write(
      `begin; insert into public.certification_milestones(user_id,id,revision,deleted_at) values ('${session.user.id}','${id}',0,clock_timestamp()); select 'marker-holder:' || pg_backend_pid();`,
    );
    await holder.waitFor(/marker-holder:\d+/);
    const holderPid = Number(holder.stdout.match(/marker-holder:(\d+)/)?.[1]);
    if (!Number.isInteger(holderPid)) throw new Error('Marker holder did not report its backend PID.');
    pending = saveResponse(session, id);
    await waitForBlocked(holderPid);
    holder.write('commit;');
    const result = await holder.finish();
    finished = true;
    if (result.status !== 0) throw new Error(`Marker holder commit failed: ${result.stderr}`);
    await expectCode(await pending, 'PT412', 'Insert-conflict fallback create');
    await assertHiddenAndRejected(session, id);
  } finally {
    if (!finished) {
      holder.write('rollback;');
      await holder.finish();
      await pending?.catch(() => undefined);
    }
  }
}

export async function verifyCertificationMilestoneConcurrency(session: AuthSession) {
  await verifyUnknownDeleteRace(session);
  await verifyInsertConflictFallback(session);
  console.log('Certification milestone delete/create and insert-conflict races verified.');
}
