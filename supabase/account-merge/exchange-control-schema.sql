-- #58 authorization/exchange claim用のprivate metadata。既存legはNULLのまま維持する。
alter table kaq_private.account_proof_legs
  add column authorization_claim_id uuid,
  add column authorization_request_hash bytea,
  add column authorization_prepared_at timestamptz,
  add column authorization_runtime_revision bigint,
  add constraint account_proof_legs_authorization_claim_pair check (
    (authorization_claim_id is null) = (authorization_request_hash is null)
  ),
  add constraint account_proof_legs_authorization_claim_nonzero check (
    authorization_claim_id is null
    or authorization_claim_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  add constraint account_proof_legs_authorization_request_hash_length check (
    authorization_request_hash is null or octet_length(authorization_request_hash) = 32
  ),
  add constraint account_proof_legs_authorization_prepared_pair check (
    (authorization_prepared_at is null) = (authorization_runtime_revision is null)
  ),
  add constraint account_proof_legs_authorization_prepared_claim check (
    authorization_prepared_at is null or authorization_claim_id is not null
  ),
  add constraint account_proof_legs_authorization_prepared_time check (
    authorization_prepared_at is null
    or (authorization_prepared_at >= issued_at and authorization_prepared_at < expires_at)
  ),
  add constraint account_proof_legs_authorization_runtime_revision_safe check (
    authorization_runtime_revision is null
    or authorization_runtime_revision between 0 and 9007199254740991
  );
