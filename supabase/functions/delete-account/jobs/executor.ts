import {
  type AuthDeletion,
  AuthDeletionUnavailableError,
  type DeletionJobRepository,
  type DeletionLease,
  DeletionLeaseLostError,
  type DeletionOutcome,
  type DeletionTarget,
} from './types.ts';

function uuid(value: string) {
  return (
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) &&
    value !== '00000000-0000-0000-0000-000000000000'
  );
}
function validateTarget(target: DeletionTarget) {
  if (
    !uuid(target.userId) ||
    typeof target.isAnchor !== 'boolean' ||
    !Number.isSafeInteger(target.remainingNonAnchor) ||
    target.remainingNonAnchor < 0
  )
    throw new Error('Deletion job target is invalid.');
  if (target.isAnchor && target.remainingNonAnchor !== 0)
    throw new Error('Deletion job anchor must be processed last.');
}
export class AccountDeletionExecutor {
  constructor(
    private readonly repository: DeletionJobRepository,
    private readonly auth: AuthDeletion,
  ) {}

  private async reconcile(lease: DeletionLease, target: DeletionTarget) {
    try {
      try {
        await this.auth.remove(target.userId);
      } catch (error) {
        if (!(error instanceof AuthDeletionUnavailableError)) throw error;
      }
      if (!(await this.auth.isAbsent(target.userId))) {
        await this.repository.defer(lease, 'auth_still_present');
        return false;
      }
    } catch (error) {
      if (!(error instanceof AuthDeletionUnavailableError)) throw error;
      await this.repository.defer(lease, 'auth_unavailable');
      return false;
    }
    return this.repository.confirmAbsent(lease, target);
  }

  private async process(lease: DeletionLease): Promise<DeletionOutcome> {
    const seen = new Set<string>();
    // 一requestの作業量だけを制限し、accountのmember数に上限を設けない。
    for (let count = 0; count < 8; count++) {
      const target = await this.repository.nextTarget(lease);
      if (target === null) return (await this.repository.complete(lease)) ? 'completed' : 'pending';
      validateTarget(target);
      if (seen.has(target.userId)) throw new Error('Deletion job repeated an already confirmed target.');
      seen.add(target.userId);
      if (!(await this.reconcile(lease, target))) return 'pending';
    }
    await this.repository.defer(lease, 'batch_limit');
    return 'pending';
  }

  async run(): Promise<DeletionOutcome> {
    const lease = await this.repository.claimDue();
    if (lease === null) return 'idle';
    if (!uuid(lease.jobId) || !uuid(lease.leaseId)) throw new Error('Deletion job lease is invalid.');
    try {
      return await this.process(lease);
    } catch (error) {
      if (error instanceof DeletionLeaseLostError) return 'pending';
      throw error;
    }
  }
}
