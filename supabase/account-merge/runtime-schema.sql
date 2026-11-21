-- #58 runtime CAS のprivate-only拡張。既存migrationは変更しない。
alter table kaq_private.account_proof_runtime
  add column phase text not null default 'leg' check (phase in ('leg', 'proof'));

-- 本sliceの関数はownerによる直接DB検査専用であり、API roleへ実行権を渡さない。
revoke all on table kaq_private.account_proof_runtime from public, anon, authenticated, service_role;
