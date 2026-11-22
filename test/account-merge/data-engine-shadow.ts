import { type Issuer, quoted } from './owner-shadow-support';

export function shadowOwnerPrelude(sourceOwner: Issuer, canonicalOwner: Issuer, intent: string) {
  const sourceId = quoted(sourceOwner.userId);
  const canonicalId = quoted(canonicalOwner.userId);
  const sourceSession = quoted(sourceOwner.sessionId);
  const canonicalSession = quoted(canonicalOwner.sessionId);
  return `
    do $$ begin
      -- shadow migration が作った実OAuth grant を再利用し、fixture が初期所有権を偽造しない。
      if (select count(*) from kaq_private.learning_accounts
        where id in (${sourceId}, ${canonicalId}) and status = 'active'
          and membership_revision = 0 and session_fence_at is null) <> 2
        or exists(select 1 from kaq_private.learning_memberships
          where account_id in (${sourceId}, ${canonicalId}) and auth_user_id <> account_id)
        or (select count(*) from kaq_private.learning_memberships
          where auth_user_id in (${sourceId}, ${canonicalId}) and account_id = auth_user_id
            and status = 'active' and epoch = 0 and session_fence_at is null) <> 2
        or exists(select 1 from (values
          (${sourceSession}, ${sourceId}), (${canonicalSession}, ${canonicalId})
        ) expected(session_id, auth_user_id)
          left join kaq_private.learning_session_grants grant_row on grant_row.session_id = expected.session_id
          where grant_row.auth_user_id is distinct from expected.auth_user_id
            or grant_row.account_id is distinct from expected.auth_user_id
            or grant_row.membership_epoch <> 0 or grant_row.reason <> 'legacy'
            or grant_row.proof_id is not null or grant_row.revoked_at is not null) then
        raise exception 'data-engine smoke owners lack the expected shadow ownership';
      end if;
    end $$;
    insert into kaq_private.account_intents(
      id, kind, actor_uid, actor_session_id, secret_hash, source_account_id,
      source_membership_epoch, state, expires_at
    ) values (
      '${intent}'::uuid, 'merge_existing', ${sourceId}, ${sourceSession},
      decode(repeat('ab',32),'hex'), ${sourceId}, 0, 'committed',
      clock_timestamp()+interval '5 minutes'
    );
    `;
}
