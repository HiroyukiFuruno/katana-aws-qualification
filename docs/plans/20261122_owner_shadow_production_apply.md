# owner-shadow 15th migration の本番適用契約

対象は `202611220001_learning_owner_shadow.sql` 一件だけである。これは#58全体、公開FK/RLS/RPC/client切替、proof binding、実利用者merge/deleteを完了させる手順ではない。

## 実行境界

- scriptは `bun scripts/run-owner-shadow-production.ts` で、project refを `vawysutvqmtxthbtflsu` に固定する。既定はdry-runであり、`--apply`以外に書込み経路はない。
- Keychain service `KAQ Supabase Management Token` は子processのstdoutを親processメモリだけで受ける。tokenをURL、argv、ファイル、artifact、例外文へ出力しない。
- dry-runは`read_only:true`を使わないManagement SQL endpointへ`BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE READ ONLY; ...; ROLLBACK;`を一括送信する。`read_only:true`は`supabase_read_only_user`へroleを切替えるため、apply roleの証明にならない。結果はcurrent role、privilege、ledger、public/private metadata fingerprintだけであり、利用者行、PII、secretを読まない。
- `--apply`は同じendpointへ一つのSQL frameだけを送る。frameはBEGIN SERIALIZABLE、同transactionでの固定contract fingerprint照合、原本からbyte抽出したDO body、migration ledger row、private postcondition、COMMITの順であり、14本の既存SQL・公開FK/RLS/RPC/delete/proof bindingを含まない。

## 固定preflight

1. source registryが連番の15本で、15番が最後のowner-shadowであること、source SHA-256、DO body framingを検査する。
2. production ledgerが旧14本のversion/nameと完全一致し15番不在ならpending、同version/nameかつrecorded statementsのSHAがsourceと一致するならnoop、それ以外は拒否する。
3. source manifestの12 public owner表（column/default/check/FK/ACL）、10 policy、44 public function（signature/body hash/security definer/search_path/EXECUTE ACL）、10 private表のmetadataをDB側でhash化する。表名・policy名・function signature・件数がsource inventoryと一致しないdriftは拒否し、body・利用者行・PIIは出力しない。
4. `postgres` role（SUPERUSER=false、BYPASSRLS/INHERIT/CREATEDB/CREATEROLE=true）、Auth 3表のSELECT/UPDATE、public stateのSELECT/UPDATE/INSERT、private account/member/grant/ledgerのSELECT/UPDATE/INSERT、RLS metadataをread-onlyで検査する。不足権限をGRANTしない。
5. apply frameはpreflightで取得したcontract fingerprintを同じserializable transaction内で再計算して比較する。apply後にも同じread-only preflightを再読し、ledger SHA、metadata fingerprint、serializable read-only framingを再確認する。HTTP結果不明時は先にledgerを再読し、記帳済み一致なら再送せずnoop、未記帳だけを最大3回まで再試行する。40001/55P03/PT409以外は停止する。

## 実行前DoD（root担当）

- local PostgreSQL 17 + `postgres`相当role（上記flags、Auth ownerは別role）で、同frameのcommit/rollback、ledger row、recorded source SHA、55P03/PT409と40001のretry、HTTP結果不明後のledger再読を実証する。`bun run account:owner-shadow-ops`はPG17を明示し、実GoTrue/2OIDCの既存fixtureへops検証を接続する。通常`account:integration`のPG18既定値は変更しない。応答喪失はDB commit後にfixture callbackを失わせる検証であり、実Management HTTP E2Eとは別に記録する。
- 実KAQ productionでは書込み前に上記dry-runだけを実行し、14 exact ledger、role/privilege、schema/RLS/RPC/ACL fingerprintを保存する。別cloud project、新権限、永続書込みを前提にしない。
- 実applyはrootがこのDoDとレビューを回収してから明示的に行う。本scriptを今回の担当がproductionへ実行しない。

## rollback

frameの途中失敗はtransaction rollbackでledgerを含め0変更とする。COMMIT後は既存owner/account/stateを削除して戻さず、read-only証跡を保存しforward-fixを判断する。
