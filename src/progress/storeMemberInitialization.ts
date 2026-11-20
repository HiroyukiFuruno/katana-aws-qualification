import type { MemberProgressRepository } from './member';
import { OutboxGenerationAheadError } from './retryOutboxStorage';

export async function initializeMemberGeneration(
  member: MemberProgressRepository,
  setGeneration: (generation: number) => Promise<void>,
) {
  try {
    await setGeneration(await member.initialize());
  } catch (error) {
    if (!(error instanceof OutboxGenerationAheadError)) throw error;
    await setGeneration(await member.initialize());
  }
}
