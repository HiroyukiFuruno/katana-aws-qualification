import type { Attempt } from '../attempts';
import { isTransientProgressReadError } from './api';
import type { MemberEvent, MemberProgressRepository } from './member';
import type { PendingEvent } from './retryOutboxStorage';
import type { QueuePreparation } from './retryQueuePreparation';
import { mergeMemberAttempts } from './storeMemberAttempts';
import type { ProgressSnapshot } from './storeTypes';

type PrepareAttempt = (attempts: Attempt[]) => Attempt;

export async function prepareFreshMemberAttempt(
  member: MemberProgressRepository,
  attempt: Attempt,
  prepare: PrepareAttempt | undefined,
  flushed: PendingEvent[],
  getSnapshot: () => ProgressSnapshot,
): Promise<{ fresh: MemberEvent[]; preparation: QueuePreparation }> {
  let fresh: MemberEvent[] = [];
  try {
    fresh = await member.loadAttempts(attempt);
    member.assertCurrent();
    return {
      fresh,
      preparation: prepare?.(mergeMemberAttempts(getSnapshot().attempts, flushed, fresh)) ?? attempt,
    };
  } catch (error) {
    if (!isTransientProgressReadError(error)) throw error;
    member.assertCurrent();
    return {
      fresh,
      preparation: {
        attempt: prepare?.(mergeMemberAttempts(getSnapshot().attempts, flushed)) ?? attempt,
        rethrow: error,
      },
    };
  }
}
