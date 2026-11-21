-- #58 leg prepare の private metadata。既存legはpair NULLのまま読み書きする。
alter table kaq_private.account_proof_legs
  add column prepare_idempotency_key uuid,
  add column prepare_request_hash bytea,
  add constraint account_proof_legs_prepare_request_pair check (
    (prepare_idempotency_key is null) = (prepare_request_hash is null)
  ),
  add constraint account_proof_legs_prepare_request_hash_length check (
    prepare_request_hash is null or octet_length(prepare_request_hash) = 32
  ),
  add constraint account_proof_legs_prepare_key_nonzero check (
    prepare_idempotency_key is null
    or prepare_idempotency_key <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  add constraint account_proof_legs_prepare_idempotency_unique unique (intent_id, side, prepare_idempotency_key);
