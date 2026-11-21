-- #58のissuer設定はprivateに閉じ、fixture installだけが唯一の行をseedする。
create table kaq_private.account_protocol_settings (
  id boolean primary key default true check (id),
  auth_issuer text not null check (auth_issuer ~ '^https?://[^[:space:]]+$')
);
alter table kaq_private.account_protocol_settings enable row level security;
revoke all on table kaq_private.account_protocol_settings from public, anon, authenticated, service_role;

-- 二項snapshotではmembership revisionの変更を判別できない。Auth削除後もreceiptを保つためFKは置かない。
alter table kaq_private.account_proofs
  add column account_membership_revision bigint check (account_membership_revision >= 0),
  drop constraint account_proofs_check,
  add constraint account_proofs_membership_snapshot_check check (
    (account_id is null and membership_epoch is null and account_membership_revision is null)
    or (account_id is not null and membership_epoch is not null and account_membership_revision is not null)
  ),
  add constraint account_proofs_intent_auth_uid_unique unique (intent_id, auth_uid);

-- merge_existingだけが成立済み未所属target UIDを保持でき、他のkindや非終端stateでは許可しない。
alter table kaq_private.account_intents
  drop constraint account_intents_check3,
  add constraint account_intents_target_snapshot_check check (
    (target_uid is null and target_account_id is null and target_membership_epoch is null)
    or (target_uid is not null and target_account_id is not null and target_membership_epoch is not null)
    or (kind = 'merge_existing' and target_uid is not null and target_account_id is null
      and target_membership_epoch is null and state in ('both_proved', 'cancelled', 'expired'))
  );
