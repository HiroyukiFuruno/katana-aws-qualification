import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { sql } from '../account-sdk/sql';
import { ProofConnection } from './proof-connection';

type ScopeResponse = { status: number; body: unknown };

export async function waitForSqlCondition(statement: string, label: string) {
  const deadline = performance.now() + 5_000;
  while (sql(statement) !== 't') {
    if (performance.now() >= deadline) throw new Error(`${label} deadline did not arrive`);
    await setImmediate();
  }
}

export async function rejectScopeAfterStateBarrier({
  accountId,
  label,
  request,
  mutation,
  restore,
  expected,
  beforeRelease,
}: {
  accountId: string;
  label: string;
  request: () => Promise<ScopeResponse>;
  mutation?: string;
  restore: () => void;
  expected: { status: number; code: string; message: string };
  beforeRelease?: () => Promise<void>;
}) {
  const holder = await new ProofConnection().open();
  let pending: Promise<ScopeResponse> | undefined;
  try {
    holder.send(
      `select 1 from public.learning_state where user_id='${accountId}'::uuid for update; select '${label}_locked';`,
    );
    await holder.wait(`${label}_locked`);
    pending = request();
    const graph = await holder.blocked();
    if (beforeRelease) await beforeRelease();
    if (mutation) {
      holder.send(`${mutation}; select '${label}_mutated';`);
      await holder.wait(`${label}_mutated`);
    }
    await holder.finish(Boolean(mutation));
    const rejected = await pending;
    assert.equal(rejected.status, expected.status);
    assert.deepEqual(rejected.body, {
      code: expected.code,
      details: null,
      hint: null,
      message: expected.message,
    });
    restore();
    assert.equal((await request()).status, 200, `${label} did not recover`);
    return { graph, restored: true };
  } finally {
    await holder.abort();
    if (pending) await pending.catch(() => undefined);
  }
}
