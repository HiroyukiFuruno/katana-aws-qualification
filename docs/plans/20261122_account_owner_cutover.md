# #58 owner/grant/session-fence cutover の着手契約（未実装）

一次要件は[統合計画](20261120_account_merge.md)、[データ契約](20261121_account_merge_data.md)、[proof契約](20261121_account_merge_proof.md) §7・§11である。これは `owner-next-slice-review.md` のP1四件を着手可能な規則へ落とす計画であり、production SQL、migration、Edge、DB、実利用者のmerge/deleteを変更・実行しない。2026-11-21〜22の読取観測では、project `vawysutvqmtxthbtflsu` のsource migration 14本とproduction ledger 14本（`202611210004_learning_account_foundation`まで）が一致した。これは適用許可ではない。実適用直前にlive ledger、source checksum、schema/ACL/RLS/RPC fingerprintを再取得し、14本の後へ追加する番号と順序を確定する。

## このsliceの境界

- `Auth UID` はログイン主体、`learning account ID` は全12公開owner表の論理所有者、`membership epoch` は所有境界、`learning_state.generation` は学習resetであり、相互に代用しない。
- このsliceは既存所有者を1:1 accountへ安全に移す土台である。production proof callback、candidate列挙防止UI、preview/commit、データmerge、queue復旧、membership切離し、KAQ全体退会は後続のままである。実利用者のmerge/deleteは未許可である。
- `supabase/account-merge/*.sql` はfixture用の部品であり、本番migrationではない。既存private resolver/bootstrap/proof acceptを再実装せず、同じ契約を固定search_pathのprivate helperへ昇格する。

## 現在の観測と網羅単位

- `production-migration-observation.json` はsource 14本、live ledger 14本、private foundation 10表の存在だけを読取り確認した。`production-owner-contract-observation.json` は実行roleが`postgres`、auth表ownerが`supabase_auth_admin`、private schema/table ownerが`postgres`であることと、resolver/proofに必要な列・row-lock権限を観測した。native composeのDB roleとproduction roleは同一視しない。migration開始前に、実行roleが必要なAuth lock、private DDL、public FK/RLS/RPC置換を行えることを別preflightで証明し、足りない権限を推測で付与しない。
- owner在庫は12公開表、直接RLS 10 policyである。transport在庫はliteral RPC callsite 21件とgeneric writeが許可する5名（`replace_roadmap_profile`はliteralとも重複する）で、sourceには合計44の`public.*` SQL functionがある。cutover manifestは44件すべてを「owner-scoped public entry」「owner非依存/内部helper」「catalog read」のいずれかへ分類し、前者には`require_learning_context`、EXECUTE role、header/legacy条件、対応するclient callsiteまたは非公開理由、回帰fixtureを一件ずつ記録する。21+5の経路と10 policyはこのmanifestの部分集合として全件消し込む。

`production-owner-rpc-observation.json` の追加読取観測では、extension所属を除く全public app-owned関数も44 signatures / 44 unique namesであり、source外・source欠落とも0だった。migration内の49定義は5再定義を含む。transportの26 recordsは25 unique RPC名である。これは関数bodyや実利用者データを読まず取得したmetadataであり、適用前の再照合を省略しない。

## DoR: P1を閉じる固定入力

| P1 | 着手前に固定する規則 | 不成立時 |
| --- | --- | --- |
| legacy grant | cutover transaction内で、下記のlive OAuth sessionだけを `reason='legacy'` grant化する。全sessionの一括許可にも、全員の強制再認証にも寄せない。 | grant無しは `reauthentication_required`。旧clientを推測で通さない。 |
| proof grant | proof reasonはcommitted proof bindingを必須にし、receipt/proof/session/UID/canonical account/epoch/fenceをDBで同時に束縛する。 | 任意の`reason='proof'`、別receipt/SID、未消費proofは保存もreadも拒否する。 |
| owner集合/state | 12表の`user_id`和集合だけをlegacy ownerとし、Auth-only UIDは作成対象外にする。account作成時はstateを同一transactionで一行にする。state無しは下記generation=0 preflightを通った時だけ補完する。 | Auth欠損参照、retired/deleting/detached/disabledとの衝突、generation前提不成立は全migrationをrollbackする。 |
| 旧delete | Auth FKのままのpre-cutoverでは既存single-UID delete契約を維持する。public owner FKを独立accountへ切替えるreleaseは、全membership fence、receipt、Auth削除/404確認を備える安全な全体退会または明示切離し経路と同時にしか有効化しない。 | 旧endpointを停止するだけで利用者の既存退会を失わせない。安全なdelete経路が無ければpublic cutover自体を開始しない。 |

### legacy session grant の正確なpredicate

対象はowner和集合のUID `u` と、同一transactionで `auth.users` → `auth.sessions` → `public.learning_state` → account/membership の順にlockして再検証したsessionだけである。次をすべて満たす。

1. `u` は有効な`auth.users`で、`deleted_at is null`、`banned_until`は現在時刻以前である。
2. sessionは`user_id=u`、有限かつepoch後で検査時刻+5秒以内の`created_at`、未期限切れの`not_after`（NULLは既存live判定どおり可）、third-party OAuth clientではない。+5秒は既存resolverと同じclock skew許容だけで、有効期限やfuture sessionを延長して許可する規則ではない。`assert_live_session`相当を実GoTrue表で使い、JWTの`iat`、`last_sign_in_at`、`refreshed_at`だけでは許可しない。
3. 同一sessionに実OAuthを示す`auth.mfa_amr_claims.authentication_method='oauth'`があり、refreshだけ・AMRなし・別SIDのOAuth行は対象外である。
4. backfill後のaccount/membershipは`id=account_id=u`、`epoch=0`、active、`membership_revision=0`、両fence NULL、accountは他membershipを持たない。該当sessionだけに`(session_id,u,u,0,'legacy')`を一回挿入する。

expired、ban/deleted、session-user不一致、OAuthなしのrefresh-only、失効/旧fence、既に共有/epoch変更済みのsessionはgrantを得ない。headerなし旧clientが成功できるのは、このgrantと上の未統合1:1条件が同時に成立する場合だけである。片header・不正headerは常に拒否する。

## owner和集合とstateの移行規則

和集合は次の12表の`public.user_id`である: `learning_state`、`learning_events`、`exam_sessions`、`exam_responses`、`earned_certifications`、`assessment_answers`、`roadmap_profiles`、`migration_manifests`、`migration_items`、`fundamentals_unit_progress`、`fundamentals_final_sessions`、`dashboard_settings`。各表を`UNION`して重複を除き、`auth.users.id`との内側結合後にだけ対象にする。

- **通常owner**: account IDは既存UIDと同一に固定し、`learning_accounts(active)`、`learning_memberships(active, epoch 0)`を一件ずつ作る。公開表の既存`user_id`、UUID、generation、payload/content hashは書き換えない。
- **settings-onlyまたはstate無しowner**: 他のowner表に一行でもあれば対象である。`learning_state`が無い時だけ、同一transactionで`(user_id=account_id, generation=0)`を一行追加する。これは意図した唯一の公開行追加で、既存row hashは不変、事前/事後hash帳票には新stateの`user_id`（account ID）と`generation=0`を別差分として記録する。
- **Auth-only未割当**: 12表に一行も無いUIDはaccount、membership、state、grantをすべて0件に保つ。bootstrapは`onboarding_required`であり、自動作成しない。
- **Auth欠損owner参照**: 12表和集合にあるのに`auth.users`に無いUIDは、行を削除・再割当・account化せずpreflightを失敗させる。fixtureでは旧FKを一時的に外したrollback transactionでだけ注入し、migration後の永続変更0を確認する。
- **retired/tombstone**: 同一UIDに既存private accountが`retired/deleting`、membershipが`detached/disabled`、またはfence/epochがlegacy初期値でない場合は再活性化しない。cutoverを中止する。retired ownerをbootstrap/initializeで復活させない。

### state無し owner の generation=0 preflight

`generation=0` は欠損stateを「reset済み」と読み替える値ではない。追加前に、同一serializable transactionで次を満たすことを確認する。(1) 12表和集合と`auth.users`の結合が存在し、`learning_state`だけが欠損していること、(2) source/liveの列inventoryでgenerationを意味する公開owner列は`learning_state.generation`だけであり、既存12表row・private membership/grant/intent/proofに別generation、epoch、fence、retired状態が無いこと、(3) owner row hashと件数が採取時から変化していないこと、(4) `initialize_learning_state`との競合ではinsert後に再読した唯一のstateが0であり、非0・複数・消失・hash変化ならserialization retry後も全cutoverを中止すること。既存stateがあるownerのgenerationは絶対に0へ戻さず、state無し以外の理由でgenerationを推定しない。

## 追加migrationのDDL案と公開境界

ファイル名と番号は実装開始時にsource registryとlive ledgerを照合して決める（例: `202611220001_learning_owner_shadow.sql`）。最初の追加migrationはprivate shadow/backfillと閉じたhelperだけであり、公開12表のAuth FK、RLS、RPC、REST、client headerを変更しない。既存userの通常学習・initialize・single-UID deleteをこの段階で壊さない。

1. source14本とlive適用ledgerの各hash、public schema/ACL/RLS/RPC/table hash、migration実行role/lock privilegeを別々に保存し、期待外の適用順、owner和集合のAuth欠損、既存private衝突、role不足を先に拒否する。
2. `learning_memberships`へ`unique (auth_user_id, account_id)`を加え、`learning_session_grants(auth_user_id, account_id)`をこの候補キーへ複合FK化する。これによりUIDとaccountを別々のFKで取り違えられない。
3. committed proof専用に、概念上次のprivate binding表を追加する。これはproofの元account snapshotを上書きせず、commit後のcanonical scopeを別recordにする。

   ```sql
   account_committed_proof_bindings(
     proof_id uuid primary key,
     receipt_id uuid not null,
     intent_id uuid not null,
     auth_user_id uuid not null,
     session_id uuid not null,
     canonical_account_id uuid not null,
     membership_epoch bigint not null check (membership_epoch >= 0),
     account_fence_at timestamptz,
     membership_fence_at timestamptz,
     unique (proof_id, auth_user_id, session_id, canonical_account_id, membership_epoch),
     foreign key (proof_id, intent_id, auth_user_id, session_id)
       references account_proofs(id, intent_id, auth_uid, session_id),
     foreign key (receipt_id, intent_id, canonical_account_id)
       references account_merge_receipts(id, intent_id, canonical_account_id),
     foreign key (auth_user_id, canonical_account_id)
       references learning_memberships(auth_user_id, account_id)
   )
   ```

   `account_proofs`には`(id, intent_id, auth_uid, session_id)`、receiptには`(id, intent_id, canonical_account_id)`、membershipには`(auth_user_id, account_id)`の候補キーを加える。bindingは上記の複合FKを持つ。grantは`reason='proof'`の場合だけ`proof_id`をNOT NULLにし、`(proof_id, auth_user_id, session_id, account_id, membership_epoch)`をbindingへ複合FKにする。non-proof reasonはproof binding列をすべてNULLにするCHECKを持つ。
4. proof bindingは、将来のtrusted commitがreceipt・proof消費・ownership確定と同一transactionでcommit時のscopeへ固定する。session grant発行関数は既存bindingを検査するだけで、欠落時に現在epoch/fenceから作成・更新しない。既存のlock順（Auth user→session→state→account→membership）でreceipt、proof、現在membership/accountをlockし、`intent.state='committed'`、receiptのcanonical account、proofの同一UID/SID、`consumed_at is not null`、commit時のepoch・両fenceとの全一致を検査するtriggerも置く。直接INSERT/UPDATE権限は全API roleからREVOKEする。
5. read resolverはproof grantならbinding、receipt、proof、current membership/accountを再照合し、epochと両fenceが`IS NOT DISTINCT FROM`で一致する時だけ通す。失効bindingを通常fresh判定へfallbackしない。legacy/created/reauthenticatedはproof列NULLを要求し、§7/§11どおりsession作成時刻とOAuth時刻がmax fenceを**厳密に超える**fresh sessionだけを`enroll_learning_session`で発行する。proof credentialをmain browser sessionへhand-offしない。
6. public owner cutoverは次の別release gateを満たした時だけの後続migrationとする。12表のAuth FKを`learning_accounts(id)`へのFKへ一括置換し、内部複合FK（exam/final/manifest等）はaccount IDとして同じ`user_id`を維持する。Auth削除はmembership/session grantだけにcascadeし、account・public学習行・archiveをcascade削除しない。上記44-function manifestのowner-scoped entry、直接REST、21 literal RPCとgeneric writeの5許可名、initialize/reset/import/settings/dashboard/fundamentalsを同一`require_learning_context`へ切替える。headerを証明ではなく期待scopeとして照合し、10 direct RLS policyも同じ判定にする。対応clientの固定header、read-only bootstrap、fresh enroll、安全なdelete経路、44/21+5/10 manifestのいずれかが欠ける状態ではcommitしない。

## 段階導入とrollback

1. **shadow/backfill**: 実GoTrue/Postgres/PostgRESTの合成データで、private account/membership/grant/proof bindingとstate補完だけを追加する。公開FK/RLS/RPCと旧clientを変えず、pre-cutoverのsingle-UID deleteも実動作として再確認する。
2. **public cutoverのDoR**: 対応clientのaccount/epoch header、read-only bootstrap、fresh enroll、全RLS/RPC/REST切替、旧queue隔離、全membership fenceとreceiptを持つ安全な全体退会または切離し経路を、同じrelease候補で実GoTrue検査する。新Auth UIDが旧`initialize`へ入って勝手にcloud学習を始めないことを確認する。
3. **公開cutover**: 上のDoR後だけ、全12表を`ACCESS EXCLUSIVE`で固定順lockする一transactionでFK/RLS/RPCを有効化する。44 public function、21 literal RPC、generic writeの5 RPC、10 direct RLS policyを対応表で全件消し込み、部分header、片方だけのpolicy、delete停止だけのreleaseを禁止する。
4. **障害時**: shadow migrationはcommit前rollbackで全変更0。公開cutover後はaccount/state/membershipを削除して戻さず、通常deleteを無効化するだけのmaintenanceへも逃げない。安全なdelete経路を維持したまま、receipt/hash/lock状態を保存してforward-fixする。旧Auth FKへ戻せばAuth delete cascadeを再導入するため、これを通常rollbackにしない。

## ローカル検証入力と受入条件

IT/E2EはMock、固定待機、timeout延長を使わず、実GoTrue/2 issuer/Postgres/PostgREST/Edge相当のcompose fixtureで行う。

| 固定fixture | 必須観測 |
| --- | --- |
| live OAuthのlegacy owner | 全12表hash不変、account/member/state一件、適格SIDだけlegacy grant、headerなしread/write成功、bound header成功。 |
| settings-only / state無しowner | generation preflightを通った時だけsettings等の既存row hash不変、新`learning_state(generation=0)`だけが予定差分、account/memberは一件、grantは適格SIDだけ一件（非適格なら0件）。state競合、非0generation、private scope痕跡、列inventory差分ではrollbackする。 |
| Auth-only未割当 | account/member/state/grant/queue/import 0件、bootstrap=`onboarding_required`。 |
| Auth削除済み参照、retired/tombstone | migration失敗、開始/終了catalogとrow hash一致、再活性化0件。 |
| expired/ban/deleted/mismatched SID/refresh-only/old fence | legacy grant 0件、bootstrap/readはre-auth又はdisabled、JWT refreshだけでの復帰0件。 |
| committed proof grant | consumed proof・receipt・UID/SID・canonical account・epoch・両fenceが一致する時だけproof grant/read成功。偽receipt、別intent/UID/SID、未consumed、cancelled/expired、旧epoch、次merge/reset/退会によるfence更新後は保存またはreadを拒否する。 |
| 全RLS/RPC/REST | 10 direct RLS policy、44 public SQL function、21 literal RPC、generic write経由の5 RPCを対応表で全件実行し、同一scope判定を確認する。片header、他account、detached/disabled、legacy外headerなしを拒否する。 |
| pre-cutover delete / cutover delete | pre-cutoverはsynthetic userのlive bearerで既存single-UID deleteがAuthと12表を従来どおり削除することを再確認する。public cutover候補では同入力を安全な全体退会または明示切離し経路に通し、全membership fence・receipt・再試行・Auth404まで検査する。経路未実装ならFK/RLS切替を実行しない。 |

さらにmigration runnerが15本目のみの追加を検出し、重複/欠番を拒否すること、公開schema/ACL/RLS/RPCの意図外差分0、full `bun run check`、`bun run account:typecheck`、実`bun run account:integration`、独立レビューを回収する。CIは来月の復旧まで成功根拠にせず、ローカル結果とreviewを記録する。

## #58の後続条件を縮めない

通常fresh enrollと将来main再認証はproof契約§7/§11を維持する。proof例外はcommitted bindingだけであり、`reason='proof'`、新iat、header、refreshを単独の権限証明にしない。今回の完了はowner cutoverの設計・実装候補に限り、両fresh proofのproduction Edge、preview/commit、全履歴保持と競合選択、queue復旧、切離し、KAQ全体退会、実利用者のmerge/deleteを完了または許可したことにはならない。
