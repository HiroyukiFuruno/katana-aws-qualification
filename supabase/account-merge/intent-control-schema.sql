-- #58未登録private ALTER下書き。既存migrationは変更せず、既存intent行のNULLは維持する。
alter table kaq_private.account_intents
  add column begin_idempotency_key uuid,
  add column begin_request_hash bytea,
  add constraint account_intents_begin_request_pair check (
    (begin_idempotency_key is null) = (begin_request_hash is null)
  ),
  add constraint account_intents_begin_request_hash_length check (
    begin_request_hash is null or octet_length(begin_request_hash) = 32
  ),
  add constraint account_intents_begin_key_nonzero check (
    begin_idempotency_key is null or begin_idempotency_key <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  add constraint account_intents_begin_idempotency_unique unique(actor_uid, begin_idempotency_key);
