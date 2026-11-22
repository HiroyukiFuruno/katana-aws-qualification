import assert from 'node:assert/strict';
import { test } from '@playwright/test';
import { type GrantFixture, quote } from './session-grants-fixture';
import { type Mutation, rejects, rejectsSnapshot } from './session-grants-normal-support';

export function normalGrantInvalid(getFixture: () => GrantFixture) {
  test('normal grant rejects invalid Auth/user membership and account states without grant mutation', async () => {
    const [actor, other] = getFixture().actors;
    assert(actor && other);
    const uid = quote(actor.userId);
    const sid = quote(actor.sessionId);
    await rejectsSnapshot(
      actor,
      `select to_jsonb(u)::text from auth.users u where id=${uid}`,
      `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${uid}`,
      (value) =>
        `update auth.users set banned_until=(jsonb_populate_record(null::auth.users,${quote(value)}::jsonb)).banned_until,deleted_at=(jsonb_populate_record(null::auth.users,${quote(value)}::jsonb)).deleted_at where id=${uid}`,
    );
    await rejectsSnapshot(
      actor,
      `select to_jsonb(u)::text from auth.users u where id=${uid}`,
      `update auth.users set deleted_at=clock_timestamp() where id=${uid}`,
      (value) =>
        `update auth.users set banned_until=(jsonb_populate_record(null::auth.users,${quote(value)}::jsonb)).banned_until,deleted_at=(jsonb_populate_record(null::auth.users,${quote(value)}::jsonb)).deleted_at where id=${uid}`,
    );
    for (const mutation of [
      {
        apply: `update kaq_private.learning_memberships set status='detached' where auth_user_id=${uid}`,
        restore: `update kaq_private.learning_memberships set status='active' where auth_user_id=${uid}`,
      },
      {
        apply: `update kaq_private.learning_memberships set status='disabled' where auth_user_id=${uid}`,
        restore: `update kaq_private.learning_memberships set status='active' where auth_user_id=${uid}`,
      },
      {
        apply: `update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp() where id=${uid}`,
        restore: `update kaq_private.learning_accounts set status='active',retired_at=null where id=${uid}`,
      },
      {
        apply: `update kaq_private.learning_accounts set status='deleting' where id=${uid}`,
        restore: `update kaq_private.learning_accounts set status='active' where id=${uid}`,
      },
      {
        apply: `update auth.sessions set user_id=${quote(other.userId)} where id=${sid}`,
        restore: `update auth.sessions set user_id=${uid} where id=${sid}`,
      },
    ] satisfies Mutation[])
      await rejects(actor, mutation);
  });
}
