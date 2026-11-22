# #58 migration 16: private context helper昇格

## 目的と境界

15番shadowの次に、既存fixtureで検証済みのsession、read scope、bootstrap、ordered locking helperをprivate migrationへだけ昇格する。公開44 function、RLS、FK、既存writer、旧single-UID delete、UI、実利用者データは変更しない。新owner/SIDのcatch-up、fresh enroll、committed proof grant、安全delete、public cutover、merge本体は後続であり、このmigrationの完了条件に含めない。

## DoR

- source registry 15までとshadow v6 promotion manifestの40 SHAが一致すること。
- helperの根拠は`supabase/account-merge/{session-resolver,owner-scope,bootstrap,locking-scope}.sql`と既存real GoTrue/2 OIDC fixtureである。fixture wrapper、任意GUC caller、unsafe test helperは昇格しない。
- migration 16はprivate schemaだけへ関数を追加し、公開schema/ACL/RLS/RPC/table hashを変更しない。

## 実装契約

- `SECURITY DEFINER`、固定`search_path`、明示REVOKEを各private helperに保持する。EXECUTEはread scopeの`authenticated`だけを既存契約どおり最小付与し、session/bootstrap/lockingはAPI roleへ付与しない。
- session検査は実Auth user→session→state→account/memberの順序、live SID、OAuth/MFA、epoch、fence、ordered NOWAIT と下位lock後の再検査を変えない。
- registryは16を一度だけ登録する。15のhistorical Opsはprefix 15をseedし、16を含むregistryで過去migrationを誤って再seedしない。

## DoD

1. migration 16はhelper本体をprivate schemaへ作成し、public/Auth既存row hash・公開RLS/RPC/FKが不変である。
2. registry inventoryは15→16を順序・重複・欠番なしで検査し、既存Ops fixtureはcanonical prefix-through-15で維持する。
3. migration適用後に実GoTrue/2 OIDC fixtureからprivate helperを呼び、live SID、OAuth/MFA、grant、epoch/fence、ordered NOWAITの正負ケースを通す。Docker実行はroot管理nativeだけが行う。
4. anon/authenticated/service_roleのprivate table直アクセスは拒否され、function EXECUTEは意図した最小ACLだけである。
5. targeted test、strict型、Biome、`bun run account:typecheck`、`bun run check`を回収し、source freezeに全変更pathのSHAを記録する。

## 禁止事項

production接続・適用、Docker起動、実利用者merge/delete、公開client/Edge/RPC変更、public owner cutoverを行わない。CI停止中はローカル検査を根拠にし、CI成功を主張しない。
