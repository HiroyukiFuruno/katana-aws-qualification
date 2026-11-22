import { expect, test } from 'bun:test';
import { createMemberProgressRepository } from '../src/progress/member';
import { choiceOrders, presentation } from '../src/progress/examRepositoryCodec';
import { isGuestExamDraft } from '../src/progress/guestExamCodec';
import type { ProgressRpcClient } from '../src/progress/types';

const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };

test('old member profile snapshots receive empty presentation defaults while v2 writes persist them', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'initialize_learning_state') return 7;
      if (name === 'load_roadmap_profile_snapshot_v2')
        return [{ answers: { assessment: 1 }, earned: ['saa-c03'], presentation: {}, revision: 4 }];
      if (name === 'replace_roadmap_profile_v2') return 5;
      throw new Error(`unexpected RPC ${name}`);
    },
    async select() {
      return [];
    },
  };
  const repository = createMemberProgressRepository(owner, client, { isCurrent: () => true });
  await repository.initialize();
  expect(await repository.loadProfile()).toEqual({
    profile: { answers: { assessment: 1 }, earned: ['saa-c03'], optionOrders: {}, order: [] },
    revision: 4,
  });
  await repository.replaceProfile(
    {
      answers: { assessment: 1 },
      earned: ['saa-c03'],
      optionOrders: { assessment: [2, 0, 3, 1] },
      order: ['assessment'],
    },
    4,
  );
  expect(calls.at(-1)).toEqual({
    name: 'replace_roadmap_profile_v2',
    args: {
      p_answers: { assessment: 1 },
      p_earned: ['saa-c03'],
      p_expected_generation: 7,
      p_expected_revision: 4,
      p_presentation: { optionOrders: { assessment: [2, 0, 3, 1] }, order: ['assessment'] },
    },
  });
});

test('exam presentation preserves only bounded unique choices and old guest drafts remain readable', () => {
  expect(presentation(['["q",1]'], { '["q",1]': ['c', 'a', 'b'], '["other",1]': ['x'] })).toEqual({
    choiceOrders: { '["q",1]': ['c', 'a', 'b'] },
  });
  expect(choiceOrders({ choiceOrders: { '["q",1]': ['c', 'a', 'b'] } })).toEqual({
    '["q",1]': ['c', 'a', 'b'],
  });
  expect(
    isGuestExamDraft({
      deadline: 1,
      id: 'exam',
      order: ['["q",1]'],
      position: 0,
      responses: {},
    }),
  ).toBeTrue();
  expect(
    isGuestExamDraft({
      choiceOrders: { '["q",1]': ['a', 'a'] },
      deadline: 1,
      id: 'exam',
      order: ['["q",1]'],
      position: 0,
      responses: {},
    }),
  ).toBeFalse();
});
