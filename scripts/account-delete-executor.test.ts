import { expect, test } from 'bun:test';
import { AccountDeletionExecutor } from '../supabase/functions/delete-account/jobs/executor.ts';
import {
  type AuthDeletion,
  AuthDeletionUnavailableError,
  type DeletionJobRepository,
  type DeletionTarget,
} from '../supabase/functions/delete-account/jobs/types.ts';

const anchor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const lease = {
  jobId: '33333333-3333-4333-8333-333333333333',
  leaseId: '44444444-4444-4444-8444-444444444444',
};
function fixture(targets: DeletionTarget[]) {
  const calls: string[] = [];
  const queue = [...targets];
  let pending: DeletionTarget | null = null;
  let claim = true;
  let confirmed = true;
  const repository: DeletionJobRepository = {
    async claimDue() {
      return claim ? lease : null;
    },
    async nextTarget() {
      pending = queue.shift() ?? null;
      return pending;
    },
    async confirmAbsent(_lease, target) {
      calls.push(`confirm:${target.userId}`);
      return confirmed;
    },
    async defer(_lease, reason) {
      calls.push(`defer:${reason}`);
    },
    async complete() {
      calls.push('complete');
      return pending === null;
    },
  };
  let exists = false;
  let removalError: Error | null = null;
  const auth: AuthDeletion = {
    async remove(userId) {
      calls.push(`delete:${userId}`);
      if (removalError) throw removalError;
    },
    async isAbsent(userId) {
      calls.push(`get:${userId}`);
      return !exists;
    },
  };
  return {
    calls,
    repository,
    auth,
    setClaim: (value: boolean) => {
      claim = value;
    },
    setConfirmed: (value: boolean) => {
      confirmed = value;
    },
    setExists: (value: boolean) => {
      exists = value;
    },
    failRemove: (value: Error) => {
      removalError = value;
    },
  };
}
const target = (userId: string, isAnchor: boolean, remainingNonAnchor = 0) => ({
  userId,
  isAnchor,
  remainingNonAnchor,
});

test('claims only a server-owned job and confirms all users before completing', async () => {
  const f = fixture([target(other, false), target(anchor, true)]);
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('completed');
  expect(f.calls).toEqual([
    `delete:${other}`,
    `get:${other}`,
    `confirm:${other}`,
    `delete:${anchor}`,
    `get:${anchor}`,
    `confirm:${anchor}`,
    'complete',
  ]);
});
test('no due job makes no Auth requests', async () => {
  const f = fixture([]);
  f.setClaim(false);
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('idle');
  expect(f.calls).toEqual([]);
});
test('an anchor with unfinished non-anchors fails before an Auth deletion', async () => {
  const f = fixture([target(anchor, true, 1)]);
  await expect(new AccountDeletionExecutor(f.repository, f.auth).run()).rejects.toThrow('anchor');
  expect(f.calls).toEqual([]);
});
test('a still-present user is deferred and never produces completed', async () => {
  const f = fixture([target(other, false), target(anchor, true)]);
  f.setExists(true);
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('pending');
  expect(f.calls).toEqual([`delete:${other}`, `get:${other}`, 'defer:auth_still_present']);
});
test('lost lease after confirmation cannot delete the next user', async () => {
  const f = fixture([target(other, false), target(anchor, true)]);
  f.setConfirmed(false);
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('pending');
  expect(f.calls).toEqual([`delete:${other}`, `get:${other}`, `confirm:${other}`]);
});
test('an ambiguous DELETE is reconciled using GET, never the DELETE response alone', async () => {
  const f = fixture([target(other, false)]);
  f.failRemove(new AuthDeletionUnavailableError());
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('completed');
  expect(f.calls).toEqual([`delete:${other}`, `get:${other}`, `confirm:${other}`, 'complete']);
});

test('unexpected programming errors are propagated without confirming or deleting another user', async () => {
  const f = fixture([target(other, false), target(anchor, true)]);
  f.failRemove(new Error('unexpected fixture failure'));
  await expect(new AccountDeletionExecutor(f.repository, f.auth).run()).rejects.toThrow(
    'unexpected fixture failure',
  );
  expect(f.calls).toEqual([`delete:${other}`]);
});
test('an unavailable confirmation preserves the pending job', async () => {
  const f = fixture([target(other, false)]);
  f.auth.isAbsent = async () => {
    throw new AuthDeletionUnavailableError();
  };
  expect(await new AccountDeletionExecutor(f.repository, f.auth).run()).toBe('pending');
  expect(f.calls).toEqual([`delete:${other}`, 'defer:auth_unavailable']);
});
test('an invalid database target is rejected before an Auth request', async () => {
  const f = fixture([target('00000000-0000-0000-0000-000000000000', false)]);
  await expect(new AccountDeletionExecutor(f.repository, f.auth).run()).rejects.toThrow(
    'target is invalid',
  );
  expect(f.calls).toEqual([]);
});
