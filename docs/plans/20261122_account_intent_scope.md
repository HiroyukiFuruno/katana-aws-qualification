# account intent scope lock（preview/commit 前提、未公開）

## 範囲

この部品は、署名済み main request context と intent ID/secret/expected revision から、preview/commit が後で使う一貫した private scope snapshot を作る。所有移動、learning data の書込み、preview digest、choice、receipt 作成、公開 RPC/REST、production migration は実装しない。

## preview authority source candidate

`prepare_account_merge_preview(intent_id, secret, expected_revision)` はこの scope helper を一回だけ呼び、既存 owner が一つ又は二つの operation について、combined v2 snapshot と owner ごとの v2 snapshot を同一 SQL statement で materialize する。raw document は private intent にのみ残し、test-only signed wrapper は preview ID、revision、digest、expiry、非識別件数だけを返す。preview は intent/proof/leg と now + 2 minutes の最短 TTL を使い、re-preview は新 UUID と CAS revision を必要とする。公開 route、commit、migration registry はこの source candidate に含めない。

入力に UID、account ID、session ID、target selector は置かない。actor advisory → intent row → initial proof/snapshot → 全対象 Auth UID → proof を含む session/AMR → `learning_state` → account/membership の順を固定し、下位 lock 後の UID 増加は追加 lock で補わず `KAQ_INTENT_SCOPE_RETRY` で中止する。source/target proof の session は相互に distinct かつ main session と異なり、保存済み session created/OAuth AMR/leg state・issue・expiry・consumption を lower lock 後に再照合する。

## 入出力

`kaq_private.lock_account_intent_scope(intent_id uuid, intent_secret text, expected_revision bigint)` は SECURITY DEFINER/private only とする。READ COMMITTED 以外、再入、部分/不正 binding header、期限切れ、actor/secret/revision 不一致、proof/session/member/account/state の stale を拒否する。

返却 JSON は provisional internal operation、verified existing account ID、generation、非識別の membership count、intent revision/state だけである。全 status の membership snapshot（UID、epoch、fence を含む）は private に保持して比較するが返さない。proof 当事者だけは active を必須にし、inactive な同居 member も集合固定の対象とする。token、nonce、secret/hash、UID を返さず、digest/preview/data は別部品の責務とする。

## operation

- `add_existing`: actor は Auth-only、target は既存 account。account/state を作らない。
- `merge_existing`: actor は既存 account、target は Auth-only。actor scope だけを lock する。
- `merge_existing` の両側 existing account: 二 account が distinct である場合だけ lock する。同 account/no-op/terminal state は本 helper が成功として扱わず receipt path へ委ねる。

既存 `lock_learning_scope` は actor membership を必須にする writer helper のため、Auth-only actor/target を含む本用途に流用しない。

## 検証

source test は positive 3 operation と、reentry/isolation/header/revision/expiry を固定する。native は実2 OIDC/proof acceptance 後の signed HTTP fixtureで、Auth DELETE/member 追加/epoch-revision/state更新/intent、grant revoke と proof leg の TTL 失効を lock barrier で競合させて拒否する。proof OAuth AMR update は upper-phase SHARE lock を待機することを観測して rollback 復元する。Mock、固定 sleep、JWT exp 改変、production 接続は使わない。
