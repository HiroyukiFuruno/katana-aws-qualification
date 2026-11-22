import assert from 'node:assert/strict';
import { sql } from './commands';
import { type Issuer, privateRows, quoted, removeShadowRows } from './owner-shadow-support';
import { ProofConnection } from './proof-connection';
import { publicState } from './public-state';

export async function verifyOwnerShadowAuthNowait(
  apply: () => void,
  ownerIds: string[],
  issuer: Issuer,
  settingsId: string,
) {
  const before = publicState();
  const holder = await new ProofConnection().open();
  try {
    holder.send(
      `select 1 from auth.users where id=${quoted(issuer.userId)} for update; select 'owner_shadow_auth_locked';`,
    );
    await holder.wait('owner_shadow_auth_locked');
    assert.throws(() => apply(), /PT409.*KAQ_OWNER_SHADOW_RETRY/s);
    assert.deepEqual(privateRows(ownerIds), { accounts: 0, members: 0, grants: 0 });
    assert.deepEqual(publicState(), before, 'NOWAIT rejection changed public state');
    await holder.finish();
    apply();
    assert.deepEqual(privateRows(ownerIds), { accounts: 4, members: 4, grants: 2 });
    return { rejected: 'PT409/KAQ_OWNER_SHADOW_RETRY', retried: true };
  } finally {
    await holder.abort();
    removeShadowRows(ownerIds);
    // settings-only ownerのstate補完は次の成功検査に渡さず、元のfixtureへ戻す。
    const settings = quoted(settingsId);
    sql(`delete from public.learning_state where user_id=${settings}`);
    assert.deepEqual(publicState(), before, 'NOWAIT retry cleanup changed public state');
  }
}
