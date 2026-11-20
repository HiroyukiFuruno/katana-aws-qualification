import type { Attempt } from '../attempts';
import { eventFromRow, eventPayload, type MemberEvent } from './memberEventCodec';
import type { Profile } from './profileTypes';
import type { MemberProgressOwner, ProgressOperation, ProgressRpcClient } from './types';
import { assertCurrentProgressOwner } from './types';

export type { MemberEvent } from './memberEventCodec';

type ProfileSnapshotRow = { earned: string[]; answers: Record<string, number>; revision: number };

export type MemberProgressRepository = {
  readonly owner: MemberProgressOwner;
  append(event: MemberEvent): Promise<string>;
  assertCurrent(): void;
  initialize(): Promise<number>;
  refreshGeneration(): Promise<boolean>;
  loadAttempts(question?: Pick<Attempt, 'questionId' | 'questionRevision'>): Promise<MemberEvent[]>;
  loadProfile(): Promise<{ profile: Profile; revision: number }>;
  replaceProfile(profile: Profile, expectedRevision: number): Promise<number>;
  reset(): Promise<number>;
  write<T>(name: string, args: Record<string, unknown>): Promise<T>;
};

export function createMemberProgressRepository(
  owner: MemberProgressOwner,
  client: ProgressRpcClient,
  operation: ProgressOperation,
): MemberProgressRepository {
  let generation: number | undefined;
  async function rpc<T>(name: string, args: Record<string, unknown>) {
    assertCurrentProgressOwner(operation);
    const result = await client.rpc<T>(name, args);
    assertCurrentProgressOwner(operation);
    return result;
  }
  async function select<T>(table: string, filters?: Record<string, string>) {
    assertCurrentProgressOwner(operation);
    const result = await client.select<T>(table, filters);
    assertCurrentProgressOwner(operation);
    return result;
  }
  async function write<T>(name: string, args: Record<string, unknown>) {
    return rpc<T>(name, { ...args, p_expected_generation: generation });
  }
  return {
    owner,
    assertCurrent: () => assertCurrentProgressOwner(operation),
    async initialize() {
      generation = await rpc<number>('initialize_learning_state', {});
      return generation;
    },
    async refreshGeneration() {
      const previous = generation;
      generation = await rpc<number>('initialize_learning_state', {});
      return previous !== generation;
    },
    append: (event) =>
      write<string>('append_learning_event', {
        p_event: eventPayload(event),
      }),
    async loadAttempts(question) {
      const initialGeneration = generation;
      const rows = await select<Parameters<typeof eventFromRow>[0][]>(
        'learning_events',
        question && {
          question_id: `eq.${question.questionId}`,
          question_revision: `eq.${question.questionRevision}`,
        },
      );
      if (initialGeneration !== undefined) {
        const currentGeneration = await rpc<number>('initialize_learning_state', {});
        if (currentGeneration !== initialGeneration)
          throw new Error('Learning data changed during read');
      }
      return rows.map(eventFromRow);
    },
    async loadProfile() {
      const [snapshot] = await rpc<ProfileSnapshotRow[]>('load_roadmap_profile_snapshot', {});
      return {
        profile: {
          earned: snapshot?.earned ?? [],
          answers: snapshot?.answers ?? {},
        },
        revision: snapshot?.revision ?? 0,
      };
    },
    replaceProfile: (profile, expectedRevision) =>
      write<number>('replace_roadmap_profile', {
        p_earned: profile.earned,
        p_answers: profile.answers,
        p_expected_revision: expectedRevision,
      }),
    async reset() {
      generation = await write<number>('reset_my_learning_data', {});
      return generation;
    },
    write,
  };
}
