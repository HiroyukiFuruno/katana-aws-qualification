export type DeletionLease = { jobId: string; leaseId: string };
export type DeletionTarget = { userId: string; isAnchor: boolean; remainingNonAnchor: number };
export type DeletionOutcome = 'completed' | 'pending' | 'idle';

// RPCは元同意・全scope fence・固定UID集合・leaseを毎回DBで検証し、任意のselectorを受けない。
export interface DeletionJobRepository {
  claimDue(): Promise<DeletionLease | null>;
  nextTarget(lease: DeletionLease): Promise<DeletionTarget | null>;
  confirmAbsent(lease: DeletionLease, target: DeletionTarget): Promise<boolean>;
  defer(
    lease: DeletionLease,
    reason: 'auth_still_present' | 'auth_unavailable' | 'batch_limit',
  ): Promise<void>;
  complete(lease: DeletionLease): Promise<boolean>;
}
export interface AuthDeletion {
  remove(userId: string): Promise<void>;
  isAbsent(userId: string): Promise<boolean>;
}
export class AuthDeletionUnavailableError extends Error {
  constructor() {
    super('Auth deletion result is unavailable.');
  }
}
export class DeletionLeaseLostError extends Error {
  constructor() {
    super('Deletion job lease is no longer current.');
  }
}
