# #58 createNew private migration 18

`202611220004_learning_account_creation.sql` は registry 17 の直後に適用する private-only
migration である。public RPC/RLS/FK/client/callback は変更しない。

native runner は canonical registry を完全照合した後、foundation 14 を先に適用し、deferred 15
(owner shadow) → 16 (private context helpers) → 17 (session grants) → 18 (この migration) の順に
適用する。18 適用後に SDK protected-table inventory、scope/locking receipt の receipt table 保護、
fixture-only wrapper を有効化してから実OAuth/PostgREST spec を実行する。この順序を逆転させず、18 は
未登録の migration directory file として実行しない。

- Auth UID と同値の初期 account、active member epoch 0、state generation 0、current OAuth SID の
  `created` grant、Auth UID UNIQUE receipt を一 transaction で作る。
- consent と nonzero request key、READ COMMITTED、Auth UPDATE→session/AMR NOWAIT→state/account/
  member/grant の順を必須にし、待機後に live JWT/session/not_after/OAuth/fence/scope を再検査する。
- 同 UID/key/SID と初期 scope/created grant が全て同じ再送だけ、同一 `receipt_id` を含む
  `{receipt_id,account_id,membership_epoch,generation}` を返す。receipt ID は本人の opaque 結果 ID で
  あって認証 secret ではない。別 key/SID や後続 scope 変更は conflict とする。
- 12 public owner 表、private membership/account/grant/receipt の既存行、retired/deleting、
  detached/disabled、epoch/fence は新規化・復活しない。intent/proof の過去履歴をゼロ件条件にはしない。

実 native は実 GoTrue/2OIDC/PostgREST signed JWT と fixture-only wrapper で、正常・同一 SID/key
再送（scope と receipt UUID 同一）・並行・Auth/session/OAuth/fence/public-owner 拒否・row hash/ACL
不変を確認する。Auth `FOR UPDATE` holder と signed HTTP create の待機観測は attach の上位lock境界だけを
検証し、未接続の public attach 成功を代用しない。Docker 実行は root/Luna 担当で、この source slice は
#58/public cutover 完了ではない。

fixture の副作用比較は public 全行と、`auth.audit_log_entries` を除く Auth/private 全行を対象にする。
監査ログは生成時刻を持つため除外するが、他の Auth/private/public row は mutation 後の基準値と RPC 後を
完全一致させる。reserved account、状態付きmembership、fence、非0 generation は仕様本体ではなく拒否経路を
実証する synthetic input と明記し、fixture cleanup 前にその副作用がゼロであることを確認する。
