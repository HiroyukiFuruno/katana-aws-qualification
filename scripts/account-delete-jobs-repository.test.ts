import { expect, test } from 'bun:test';
import {
  type DeletionLease,
  type DeletionTarget,
  type PrivateDeleteJobRpc,
  PrivateDeletionJobRepository,
} from '../supabase/functions/delete-account/jobs/repository.ts';

const ids = {
  job: '11111111-1111-4111-8111-111111111111',
  lease: '22222222-2222-4222-8222-222222222222',
  user: '33333333-3333-4333-8333-333333333333',
  receipt: '44444444-4444-4444-8444-444444444444',
};
type RootRepositoryContract = {
  claimDue(): Promise<DeletionLease | null>;
  nextTarget(lease: DeletionLease): Promise<DeletionTarget | null>;
  confirmAbsent(lease: DeletionLease, target: DeletionTarget): Promise<boolean>;
  defer(
    lease: DeletionLease,
    reason: 'auth_still_present' | 'auth_unavailable' | 'batch_limit',
  ): Promise<void>;
  complete(lease: DeletionLease): Promise<boolean>;
};

function fixture(results: unknown[]) {
  const calls: { name: string; arguments_: Readonly<Record<string, unknown>> }[] = [];
  const rpc: PrivateDeleteJobRpc = {
    async invoke(name, arguments_) {
      calls.push({ name, arguments_ });
      return results.shift();
    },
  };
  return { calls, repository: new PrivateDeletionJobRepository(rpc) };
}

test('repository satisfies the executor contract with fixed private calls only', async () => {
  const f = fixture([
    [{ job_id: ids.job, lease_id: ids.lease }],
    [{ auth_uid: ids.user, is_anchor: false, remaining_non_anchor: 1 }],
    true,
    null,
    true,
  ]);
  const contract: RootRepositoryContract = f.repository;
  const lease = await contract.claimDue();
  expect(lease).toEqual({ jobId: ids.job, leaseId: ids.lease });
  if (!lease) throw new Error('Missing fixture lease');
  const target = await contract.nextTarget(lease);
  if (!target) throw new Error('Missing fixture target');
  await contract.confirmAbsent(lease, target);
  await contract.defer(lease, 'batch_limit');
  expect(await contract.complete(lease)).toBe(true);
  expect(f.calls).toEqual([
    { name: 'kaq_private.claim_account_delete_job', arguments_: {} },
    { name: 'kaq_private.next_account_delete_target', arguments_: { p_lease_id: ids.lease } },
    {
      name: 'kaq_private.confirm_account_delete_target_absent',
      arguments_: { p_lease_id: ids.lease, p_auth_uid: ids.user },
    },
    {
      name: 'kaq_private.defer_account_delete_job',
      arguments_: { p_lease_id: ids.lease, p_reason: 'batch_limit' },
    },
    { name: 'kaq_private.complete_account_delete_job', arguments_: { p_lease_id: ids.lease } },
  ]);
});

test('repository accepts only completed or unknown receipt lookup results', async () => {
  const f = fixture(['completed', 'unknown', 'failed']);
  expect(await f.repository.receiptStatus(ids.receipt)).toBe('completed');
  expect(await f.repository.receiptStatus(ids.receipt)).toBe('unknown');
  await expect(f.repository.receiptStatus(ids.receipt)).rejects.toThrow('receipt result');
});

test('repository rejects malformed rows before a target reaches Auth deletion', async () => {
  const f = fixture([[{ job_id: ids.job, lease_id: 'not-a-uuid' }]]);
  await expect(f.repository.claimDue()).rejects.toThrow('lease');
  expect(f.calls).toEqual([{ name: 'kaq_private.claim_account_delete_job', arguments_: {} }]);
});
