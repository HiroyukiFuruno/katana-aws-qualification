# account deletion durable job ledger（private / 未接続）

## 境界

この部品は、既に承認され fence 済みの KAQ 全体退会 job を、固定した Auth UID だけに対して安全に lease・再試行・完了する private ledger である。既存 single-UID Edge handler、public RPC、production migration、client、12表/lineage の消去、fresh actor/consent の authority 作成は変更しない。

## authority 作成（後続の `begin_whole_account_delete` 専用）

generic service setter、UID/account/capability を受け取る public API、target を追加・scope を再割当する API は置かない。将来の private `begin_whole_account_delete` だけが、fresh verified actor と明示した whole-account consent を server-side に解決し、同一 transaction で全固定 membership/UID/SID を lock、account/member fence と grant revoke、12表・archive/provenance/lineage 消去、content evidence、job と target を確定する。

job/target は Auth/account/member への FK や CASCADE を持たない。job は scope account UUID、fence、scope/content commitment、capability hash と固定 target を private に保持するが、完了時に job/target を削除する。target の anchor は他の全 target の absent 確認後だけ処理する。

## worker repository

`claimDue()` は引数なしで、authority approved、fence/content evidence 有り、due、unleased（又は期限切れ lease）の既存 job 一件だけを claim する。`nextTarget`、`confirmAbsent`、`defer`、`complete` は lease に束縛され、任意 account/UID/scope を受け取らない。target の UID は `nextTarget` が返した固定値だけを `confirmAbsent` へ使う。

各 target 前に account が `deleting` かつ同じ fence、未確認 target 全員が disabled/fenced、target UID が他 account に再割当されていないこと、scope に未登録 member がいないこと、content erase evidence があることを再検証する。Auth DELETE 後は、固定 target の Auth UID 自体がDBにも存在しない場合にだけ membership CASCADE 消去を許容する。これによりDELETE成功直後の停止からselectorless claimで再開できる。Authが残るmembership欠落、別accountへの再割当、UID再作成は許容しない。公式GET404確認とlease CASを省略しない。違反時は削除せず retryable pending に戻す。batch は 8、lease は短命、retry は指数 backoff で最大 1 時間、attempt counter は診断用で永久 lockout にしない。capability の期限切れは server-only の selectorless worker を停止しない。

Admin DELETE の成功だけでは完了にせず、固定 UID ごとの公式 GET 404 後に `confirmAbsent` を CAS する。全 target absent と content evidence が揃った `complete` だけが job/target を消し、random receipt UUID、`completed`、非識別時刻、対象数だけの minimal receipt を残す。

## selector と privacy

wake/reconcile は body、UID、account、receipt selector を受けない selectorless operation である。network 結果不明の completion 照合だけは、random receipt UUID を selector とする別 private read とし、`completed` 又は `unknown` だけを返す。これは PII、target count、scope、failure 詳細、新規削除 authority を返さない。

## 検証と未接続

source test は private ACL、selectorless claim、lease CAS、anchor-last、reassignment/fence/content evidence guard、batch/backoff、completion scrub、minimal receipt を固定する。repository unit は Root executor の `DeletionJobRepository` と構造互換であること、fixed function name と引数だけを出すことを検査する。

実 GoTrue 2 UID/Admin DELETE/GET 404、partial failure、12表/lineage 消去、fresh actor whole-delete begin、public wake/Edge/client は後続 native/cutover の DoD であり、この core fixture 成功を全退会成功とは扱わない。
