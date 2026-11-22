export type DeletionLease = { jobId: string; leaseId: string };
export type DeletionTarget = { userId: string; isAnchor: boolean; remainingNonAnchor: number };
export type DeletionDeferReason = 'auth_still_present' | 'auth_unavailable' | 'batch_limit';

// Root executorのDeletionJobRepositoryと構造互換。private direct-RPC adapterだけを受け取る。
export interface PrivateDeleteJobRpc {
  invoke(name: string, arguments_: Readonly<Record<string, unknown>>): Promise<unknown>;
}

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) &&
    value !== '00000000-0000-0000-0000-000000000000'
  );
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid delete-job RPC result.');
  return value as Record<string, unknown>;
}
function row(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length !== 1) throw new Error('Delete-job RPC returned multiple rows.');
    return record(value[0]);
  }
  return record(value);
}
function boolean(value: unknown) {
  if (typeof value !== 'boolean') throw new Error('Invalid delete-job RPC boolean result.');
  return value;
}

export class PrivateDeletionJobRepository {
  constructor(private readonly rpc: PrivateDeleteJobRpc) {}

  async claimDue(): Promise<DeletionLease | null> {
    const value = row(await this.rpc.invoke('kaq_private.claim_account_delete_job', {}));
    if (value === null) return null;
    if (!uuid(value.job_id) || !uuid(value.lease_id)) throw new Error('Invalid delete-job lease.');
    return { jobId: value.job_id, leaseId: value.lease_id };
  }

  async nextTarget(lease: DeletionLease): Promise<DeletionTarget | null> {
    const value = row(
      await this.rpc.invoke('kaq_private.next_account_delete_target', { p_lease_id: lease.leaseId }),
    );
    if (value === null) return null;
    const userId = value.auth_uid;
    const isAnchor = value.is_anchor;
    const remainingNonAnchor = value.remaining_non_anchor;
    if (
      !uuid(userId) ||
      typeof isAnchor !== 'boolean' ||
      typeof remainingNonAnchor !== 'number' ||
      !Number.isSafeInteger(remainingNonAnchor) ||
      remainingNonAnchor < 0
    )
      throw new Error('Invalid delete-job target.');
    return {
      userId,
      isAnchor,
      remainingNonAnchor,
    };
  }

  async confirmAbsent(lease: DeletionLease, target: DeletionTarget) {
    return boolean(
      await this.rpc.invoke('kaq_private.confirm_account_delete_target_absent', {
        p_lease_id: lease.leaseId,
        p_auth_uid: target.userId,
      }),
    );
  }

  async defer(lease: DeletionLease, reason: DeletionDeferReason) {
    await this.rpc.invoke('kaq_private.defer_account_delete_job', {
      p_lease_id: lease.leaseId,
      p_reason: reason,
    });
  }

  async complete(lease: DeletionLease) {
    return boolean(
      await this.rpc.invoke('kaq_private.complete_account_delete_job', {
        p_lease_id: lease.leaseId,
      }),
    );
  }

  async receiptStatus(receiptId: string): Promise<'completed' | 'unknown'> {
    if (!uuid(receiptId)) throw new Error('Invalid deletion receipt selector.');
    const value = await this.rpc.invoke('kaq_private.read_account_delete_receipt', {
      p_receipt_id: receiptId,
    });
    if (value === 'completed' || value === 'unknown') return value;
    throw new Error('Invalid deletion receipt result.');
  }
}
