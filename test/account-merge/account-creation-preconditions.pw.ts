import { expect, test } from '@playwright/test';
import {
  type CreationActor,
  createRpc,
  creationSnapshot,
  quote,
  withCreationActor,
} from './account-creation-fixture';
import { sql } from './commands';

type SyntheticInput = { name: string; seed: (uid: string) => string; clear: (uid: string) => string };

const accountClear = (
  uid: string,
) => `delete from kaq_private.learning_memberships where auth_user_id=${uid};
  delete from kaq_private.learning_accounts where id=${uid}`;

async function rejectsSynthetic(actor: CreationActor, input: SyntheticInput) {
  const uid = quote(actor.userId);
  try {
    sql(input.seed(uid));
    const mutated = creationSnapshot();
    const result = await createRpc(actor);
    expect(result.ok, input.name).toBe(false);
    expect([400, 401, 403, 409], input.name).toContain(result.status);
    expect(creationSnapshot(), input.name).toEqual(mutated);
  } finally {
    sql(input.clear(uid));
  }
}

const inputs: SyntheticInput[] = [
  {
    name: 'reserved account',
    seed: (uid) => `insert into kaq_private.learning_accounts(id) values(${uid})`,
    clear: accountClear,
  },
  ...(['detached', 'disabled'] as const).map((status) => ({
    name: `membership ${status}`,
    seed: (uid: string) => `insert into kaq_private.learning_accounts(id) values(${uid});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,status) values(${uid},${uid},'${status}')`,
    clear: accountClear,
  })),
  {
    name: 'retired account',
    seed: (uid) =>
      `insert into kaq_private.learning_accounts(id,status,retired_at) values(${uid},'retired',clock_timestamp())`,
    clear: accountClear,
  },
  {
    name: 'deleting account',
    seed: (uid) => `insert into kaq_private.learning_accounts(id,status) values(${uid},'deleting')`,
    clear: accountClear,
  },
  {
    name: 'noninitial membership epoch',
    seed: (uid) => `insert into kaq_private.learning_accounts(id) values(${uid});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,epoch) values(${uid},${uid},1)`,
    clear: accountClear,
  },
  {
    name: 'account or member fence',
    seed: (
      uid,
    ) => `insert into kaq_private.learning_accounts(id,session_fence_at) values(${uid},clock_timestamp());
      insert into kaq_private.learning_memberships(auth_user_id,account_id,session_fence_at) values(${uid},${uid},clock_timestamp())`,
    clear: accountClear,
  },
  {
    name: 'noninitial public generation',
    seed: (uid) => `insert into public.learning_state(user_id,generation) values(${uid},1)`,
    clear: (uid) => `delete from public.learning_state where user_id=${uid}`,
  },
];

for (const input of inputs) {
  test(`fresh create rejects ${input.name} without side effects`, async ({ browser }) => {
    await withCreationActor(browser, async (actor) => {
      await rejectsSynthetic(actor, input);
    });
  });
}
