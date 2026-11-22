# #58 fresh SSO・intent・session fence の具体契約案

設計日: 2026-11-21。対象は予防導線/既存2アカウント統合の認証契約。API・DDLの実装/実行結果ではない。数値は本設計の提案値であり、既存DoDを変更しない。
一次要件: [統合計画](20261120_account_merge.md)。根拠: [公式identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)、[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)、[Auth v2.198.0 sessions](https://github.com/supabase/auth/blob/v2.198.0/internal/models/sessions.go)、[同版PKCE交換](https://github.com/supabase/auth/blob/v2.198.0/internal/api/token.go)。稼働health読取はHTTP200 / v2.198.0（2026-11-20T21:18:30.513Z）、fixtureも同版。保持/競合/全writerのlock順は[データ契約](20261121_account_merge_data.md)を正本とし、本契約も従う。proof intentは既存追加/既存mergeだけに用いる。

## 1. 成立条件と信頼境界

- 所有単位は別々の verified Auth UID。provider種類の相違、provider名の厳密証明、毎回のpassword/MFAを追加要件にしない。OAuth AMRはprovider名の証拠ではない。
- 独立 `learning_accounts` と `learning_memberships(auth_user_id UNIQUE)` を正本にし、Auth identity/管理Auth表を直接書き換えず、統合のためにAuth userを削除しない。
- ブラウザの main Auth session は両proof中保持する。別storageKeyの公式 `@supabase/auth-js` PKCE clientをEdge側にlegごと生成し、verifier/tokenをmain clientと共有しない。ブラウザから任意access JWTをproofとして受け取るAPIは設けない。
- PostgRESTが実JWTの署名/issuer/audience/expを検証し、SQLは `auth.uid()`、JWTの `session_id`、`auth.sessions`、`auth.mfa_amr_claims`、intent/nonce/epochを照合する。クライアントのUID/owner/provider申告は権限証明にしない。
- Edgeは同一projectの `getUser(jwt)` による生存ユーザー確認も行う。SQLで管理schemaを読むhelperはprivate、固定search_path、最小権限、RLS再帰なしとし、authenticatedから任意実行/読取できない。service key/暗号鍵はEdge secretのみ。
- 氏名/メールによる候補検索、Auth listUsersによる列挙、自動merge、実利用者の統合/削除は対象外。両proof成立前は相手owner/件数/プロフィールを返さない。

## 2. 永続recordと提案数値

| record | 必須field / 制約 |
| --- | --- |
| intent | `id UUID, kind(add_existing/merge_existing), actor_uid, actor_session_id, secret_hash, state, created_at, expires_at, version, source_membership_snapshot?, target_membership_snapshot?, preview_id?, commit_receipt_id?`。actorはverified main JWTからのみ設定。 |
| leg | `id UUID, intent_id, side(source/target), attempt_no, version, state, issued_at, expires_at, expected_uid?, pkce_storage_key, ingest_nonce_hash, exchange_receipt_id?`。source期待UIDはactor、targetは成功時の検証UIDから初めて固定。 |
| proof | `id, intent_id, leg_id UNIQUE, auth_uid, session_id UNIQUE, session_created_at, oauth_at, membership_id?, account_id?, membership_epoch?, account_membership_revision?, expires_at, consumed_at?`。sessionの他intent/他legへの再利用は禁止。 |
| session grant | `(auth_uid, session_id, account_id, membership_epoch)` unique、発行理由/commit receiptを保存。auth.users/metadataでなくDB正本。 |
| preview / receipt | previewは両proof ID/全membership revision/generation/retain account/選択肢/algorithm version/digest/有効期限を保存。digestは全12owner表・全列・件数の安定順序row SHA-256集合から計算し、表示件数/競合も同一snapshotから作る。receiptはintent unique、最終選択と適用結果hash/新epochを保存。生JWT/nonce/verifierを監査に残さない。 |
| private runtime | leg別のSDK storage値とexchange結果はserver鍵による暗号化、secret/nonceは256bit乱数のhashのみDB比較。verifierだけは交換に必要なため暗号化して保存し、公開schema/URL/ログへ出さない。 |

- intent TTLは作成から10分（延長なし）。leg TTLは3分かintent期限の早い方。proof期限はintent期限、preview TTLは2分かintent期限の早い方。final consentはpreviewの同じdigestに対する明示POSTであり、通常の画面表示/GETで代用しない。
- 各sideは最大3回のleg開始。開始済みlegの失敗/取消し/通信断も1回を消費。新leg開始時に同side旧legをsupersededにし、成功proofを別対象へ再利用しない。両side計6回を上限とする。
- 同じactor UIDにactive intentは1件。secret喪失時は同じactor UID/sessionによる新規開始の明示 `replace_active:true` だけで旧intentを取消し、新secret/全proofやり直しとする（所有権変更なし）。作成はactor UIDごと15分5件を上限案とする。invalid secret/未知IDで被害者intentのattemptを消費させず、actor制限と汎用エラーで拒否する。IP制限を今回の必須条件へ追加しない。
- 時刻の正本はDB UTC。下限のclock skew緩和は0秒とし、`sessions.created_at >= leg.issued_at` かつDB OAuth AMR `updated_at >= leg.issued_at` を要求する。Auth時計がDBより遅くfalse rejectしたら再認証し、古いsessionを許可して救済しない。
- 上限の時計差許容は5秒。JWT AMR秒値は `floor(epoch(DB oauth_at))` と整合させ、JWT秒精度で下限判定を代用しない。NULL時刻/不整合session/AMRは拒否し、現在時刻で補完しない。clock差の実測回帰をDoRに含める。
- DB row lockはtransaction内だけ。OAuth待ちの間はstate/account lockを保持しない。新しいSQL timeout設定を今回の必須条件へ追加せず、既存の実行制限とrollback/再試行契約を使う。検査ゲート/CI timeoutは変更しない。

## 3. ブラウザ・Edge・公式SDKのPKCE契約

1. `POST /account-intents` はmain Bearerを検証し、intentと一回だけ返す `intent_secret` を発行する。ブラウザはsecretをintent単位のsessionStorageに置き、URL/localStorage/GA4/ログへ出さない。DBはhashのみ保持する。別タブへsecretを自動コピーしない。
2. `POST /account-intents/:id/legs` はmain Bearerとbodyのsecretを確認し、legを発行する。Edge専用storage adapterのkeyは `kaq-proof:<intent UUID>:<leg UUID>:<attempt>`。公式 `GoTrueClient` は `flowType:pkce, persistSession:true, storage:privateAdapter, storageKey:legKey, autoRefreshToken:false, detectSessionInUrl:false` とし、永続化は当該private adapter内だけで行う。main client storageへ触れない。
3. Edgeが公式 `signInWithOAuth({provider, options:{redirectTo: allowlistedCallbackWithPublicLegId, skipBrowserRedirect:true}})` を呼ぶ。SDK生成verifier/storage書込の永続化成功後にだけ認可URLを返す。任意redirectTo、任意token endpoint、独自OAuth state署名/独自Auth serverは実装しない。
4. ブラウザは返された公式認可URLへ遷移。callbackはcodeと公開leg IDを受けた直後、analytics/ルータ初期化前に `history.replaceState` でcode/error等をURLから除去し、メモリにだけ保持する。callbackと認可URL/例外ログはqueryを記録せず、Referrer-Policy:no-referrer、第三者scriptなしとする。
5. ブラウザはmain Bearerを維持したまま `POST /account-intents/:id/legs/:leg/exchange` に `{code, intent_secret, expected_leg_version}` をbodyで送る。CORSは正規originに限定。intent secret/main session/leg version/TTL/CASに失敗したらcode交換前に拒否。OAuth認可codeはプロトコル上callback URLへ来るが、独自nonce/verifier/tokenをURLへ追加しない。
6. Edgeはleg別storageを復元した同じ公式SDKの `exchangeCodeForSession(code)` を実行する。ingest nonceはEdgeだけが取得できるprivate runtime recordから読む。code/verifierの任意組合せやブラウザ持込みaccess JWTは受け取らない。主sessionをproofとして転用しない。
7. 交換結果はEdgeが署名/issuer/audience/expと `getUser(access_token)` を確認する。proof JWTをBearerにしてPostgRESTの `accept_account_proof` を呼び、同RPCはingest nonce、実 `auth.uid()/session_id`、DB session/OAuth AMR、期待UID、membership snapshotを同一transactionで検証・保存する。sourceはactor UID必須、targetは初回成立時に固定。発行元/公開鍵の検証はSDKのデコードだけで済ませない。
8. publicのproof RPCはnonceを得られず成立しない。private runtime作成/読取/暗号化storage操作はEdgeの限定server roleだけに許可する。`prepare_account_leg` のactor側RPCはingest nonceを返さず、nonce作成/取得はEdge専用のprivate runtime操作で分離する。service-roleで「渡されたUIDを信じてproof insert」する近道は禁止。SQLのproof UIDは必ずPostgRESTが検証したproof JWTから導く。
9. browserへは `{intent_id, leg_id, state, expires_at}` のみ返す。token/verifier/ingest nonce/相手UIDは返さない。Edge SDKのproof tokenは最終確認まで暗号化private storageへ保持し、検証とfinal consent後の一回の公式policy refreshに使う。外部social provider tokenは不要なので保存しない。SDKがsession JSONへ含める `provider_token/provider_refresh_token` はprivate storage adapterで永続化前に除外し、verifierやAuth access/refresh tokenのSDK形式は維持する。
10. callback到着/POST再送は同一legの保存結果に収束する。source期待UID不一致はproof不成立、targetを一度確定後の対象変更はintent取消し→両側を最初から認証する。mainの別UID/別sessionへの切替でも既存intentを継承しない。

## 4. 交換成功後の障害・秘密の保管境界

- legは `issued → exchanging → exchanged → proved` とCAS更新する。`exchanging` への遷移で並行code交換を一つに限定し、他の要求はstatus照会へ返す。HTTP完了よりDB receiptを正本とする。
- GoTrue code交換直後、返されたaccess/refresh tokenを暗号化exchange receiptに保存してからproof登録する。保存するのは当該legの同一sessionだけで、TTLはleg期限まで（最大3分）、自動refreshは禁止。final consent用のproof tokenはproof成立後intent期限まで（最大10分）保持し、完了/取消し/期限切れで暗号化blobを消去する。
- exchange receipt保存後にproof RPCが失敗した場合、同じleg/secret/main session/versionで再送を受け、保存済みtokenを復号して署名/getUser/DB時刻/live性を再検証し、同じsessionだけを再登録する。codeの再交換・別tokenへの置換・期限延長をしない。
- GoTrue交換成功とexchange receipt永続化の間にEdgeが停止した場合は、外部AuthとDBは原子的でないため同じcodeの回収を保証できない。`exchange_unknown` として当該legをsupersededにし、新しいleg/PKCEで再認証する。残ったAuth sessionは学習grantを新規取得せず、proof成立扱いにしない。
- proof保存後にHTTP応答が失われた場合はnonce再消費/attempt追加をせず、同じreceiptのstatusを返す。commit後応答喪失は同一commit receiptを返す。秘密blobの削除失敗は監査/再試行し、期限切れを使用可能へ戻さない。
- callback codeの期限切れ・GoTrue失敗・取消しは元main sessionに戻れる。proof sessionの後処理は公式SDKの当該sessionだけへのlocal signOutをbest effortで行い、global signOutで元main sessionを消さない。学習アクセス拒否はsignOut成功に依存しない。

## 5. 最小API / SQL関数契約

intent系control POSTはmain Bearer＋bodyのintent secret、同origin、idempotency key UUIDを要求（開始時はsecret未発行）。新規作成はintent外の明示RPCで、検証済みmain JWTと本人のcreateNew同意だけを用いる。主JWTは開始時と同じ `(sub, session_id)` が必要で、同sessionの通常refreshはcontrolだけに使える。API戻り値はEdge＋SQLの合成結果であり、SQL内でOAuth URL生成/ネットワーク呼出しをしない。認証済みでも別actorの存在確認には汎用404を返す。

| API / SQL | 引数 → 戻り値 / 条件 |
| --- | --- |
| `GET /account-bootstrap` / `account_bootstrap()` | main JWT → `{state:onboarding_required/ready/reauthentication_required/disabled, account_id?, membership_epoch?, generation?}`。read only。本人だけ返す。ready時だけ後続store/guest import/outboxを開始。 |
| `POST /account-intents` / `begin_account_intent(kind, idempotency_key, replace_active:false)` | verified main JWT → `{id, secret(one-time), version, expires_at, source_state}`。sourceをDB membershipから固定。add_existingは未membership、merge_existingはactive membershipのみ。secret再取得不可なら同じactor sessionからreplace_active付きで新intent。 |
| `POST .../:id/legs` / `prepare_account_leg(intent, secret, side, expected_version, provider_hint)` | → `{leg_id, leg_version, authorization_url, expires_at}`。source/target各fresh認証。provider_hintは公式provider allowlistの開始希望だけで、所有証明/候補検索には使わない。 |
| `POST .../legs/:leg/exchange` / `accept_account_proof(intent, leg, ingest_nonce, leg_version)` | Edgeが交換しproof JWTでSQLへ送信 → `{state:source_proved/both_proved/already_linked, version, expires_at}`。SQL引数にuidやsessionを受け取らない。same UIDの2回提示は2証明に数えない。active membershipが同じならalready_linked、未membershipなら `SAME_AUTH_USER` でtarget再試行とし、既存追加成功を偽らない。同ownerの別UIDもno-opのalready_linked。epoch/grant/ownerを変更しない。 |
| `POST .../:id/status` / `read_account_intent(intent, secret)` | → `{state, version, remaining_attempts, expires_at, commit_receipt_id?}`。secretはbodyだけに載せる。相手候補/秘密を返さない。 |
| `POST .../:id/preview` / `preview_account_merge(intent, secret, expected_version)` | 両proof成立 → `{preview_id, digest, expires_at, verified_accounts, retained_account_options, counts, conflicts, required_choices}`。既存learning_stateをUUID順UPDATE lock後にaccount/membershipを検査・lock。全12表の完全digestと表示値を同一snapshotへ束縛。 |
| `POST .../:id/commit` / `commit_account_merge(intent, secret, preview_id, digest, retain_account_id, choices, expected_version, idempotency_key, consent:true)` | → `{receipt_id, account_id, membership_epoch, generation, reauthentication_required:true}`。consent/選択全件/両proofの再検証・snapshot一致が必須。部分適用なし。同intent同payloadの再送のみ同receipt、別payloadは409。 |
| `POST .../:id/cancel` / `cancel_account_intent(intent, secret, expected_version)` | → `{state:cancelled}`。commitと同じintent lock。cancelが先ならcommit不可、commitが先なら既存receiptを返し巻戻し扱いにしない。途中proofの所有権を変更しない。 |
| `POST /rest/v1/rpc/create_new_learning_account` / `create_new_learning_account(consent:true, idempotency_key)` | 未membershipの検証済みmain JWT → `{account_id, membership_epoch, generation, receipt_id}`。本人の明示createNew一回から新account/state/membershipを原子的に作る。他ownerへの権限を与えないためfresh source leg/intentを要求しない。Auth UID UNIQUEで並行呼出しを一accountへ収束し、衝突側の新規rowはrollback。現在main sessionに初回grantを付ける。tombstone/disabled/退会済みは新規化せず拒否。 |

## 6. 状態・最終同意・ロック順

- intentの正常遷移は `awaiting_source → awaiting_target → both_proved → previewed → committed`。新規createNewはこのintent状態機械に含めない。すべて `cancelled/expired/attempts_exhausted` へ終了可能。成功済み/終了済みをopenへ戻さない。already_linkedは所有移動なしの終了receiptを返す。receiptは最終merge同意を流用せず、`kaq.account-merge.already-linked.evidence.v1` のdomain-separated evidence digest、`consent_required:false`、`no_ownership_change:true` を記録する。同intentの再送は同じreceiptだけを返す。
- source完了前のtarget開始は拒否。add_existingではsourceのfresh proofにもmembershipがないこと、targetにはactive membershipがあることを確認する。merge_existingは既存ownerから追加を開始するflowを表し、targetが未membershipなら一時accountを作らずattach、別active ownerならmergeとなる。両proof後に確定したoperationをpreviewへ固定し、attach/mergeの内容を示す最終同意が必要。preview後のmembership状態変化でoperationを自動変更しない。同UID/既に同ownerは既存のalready_linked no-opに従う。
- previewは両側の既存 `learning_state` 行をUUID順にUPDATE lockし、先行writer完了後にaccount→membershipを検査・lockする。未membership側にはstateを作らず、既存側だけlockする。全12表・全列・件数をstable orderでrow SHA-256化し、その順序付き集合をSHA-256化する。UUID/時刻/回答/revision/hashを除外せず、表示件数・競合・保持選択肢を同じsnapshotから生成する。部分revisionは完全digestの代用にしない。
- commit直前にEdgeは各proofのrefresh開始をCAS記録し、保存した同一sessionを公式SDKで各一回だけrefreshする。署名/issuer/aud/exp、sub/session ID不変、getUser成功を確認し、credentialを暗号化receiptへ保存してからpolicy_checkedとする。OAuth AMR/元のfreshness下限・TTLは更新しない。結果不明/保存失敗は当該legを使用不能にし、同token再送せず新PKCEへ戻す。GoTrue policyの確認時点とSQL commitは原子的ではない。
- SQLはintent制御row→全対象Auth user UUID順SHARE→対象session UUID順SHARE→既存learning_state UUID順UPDATE→account/membershipの一定順でlock/再検証する。初期UID集合とrevisionを下位lock後の最新snapshotで比較し、増減時は中止し追加userを後取りしない。通常writerもAuth user/sessionを先に保護しstate SHARE後にbinding/membership/sessionを最新検査する。reset・切離し・退会はstate UPDATEを最初から選び、SHAREからupgradeしない。旧membership先行順はAuth DELETE cascadeとの40P01を実測したため採用しない。STABLE read helperの再呼出しだけで待機後最新検査としない。
- commitはTTL/nonce消費/取消し/version/両proofのlive性/全membership epoch・構成/generation/全12表の完全preview digest/最終選択digestを再検査する。DB内のsession rowは共有lockを保持して同transaction中の削除を直列化し、session取消しが先なら不成立。GoTrue設定によるlive検査の限界は次節に明記する。
- preview後に履歴/設定/所属が変われば `409 PREVIEW_STALE`。データ変更だけなら両proofの残TTL内でpreviewを再生成し、再度明示同意。所有者/会員構成/epoch変更やproof失効ならintent終了→両fresh proofを取り直す。裏で承認内容を書き換えない。
- 並行A+B/A+Cはstate UPDATE lock/全membership検査/完全digestで片方だけ成功。取消し/期限切れ/不明code交換後の遅延callbackはCASで拒否。2件目が既に同ownerになっていても、未承認の内容へ自動commitしない。

## 7. 旧session・refresh・直接SELECTを閉じるfence

- accountに `session_fence_at` と `membership_revision` を持つ（完全digestの代用にはしない）。統合transactionでsource/targetの**全active membership**のepochを進め、保持先へ変更し、retired元ownerの再初期化を拒否する。二人のproof UIDだけのepoch更新では不足する。
- 同transactionで両側の旧session grantを失効させ、両proof sessionだけを新epochで許可する。proof sessionはEdge内だけに保持するため、この最小APIで利用者が実際に学習再開する経路は次のmain再認証となる。mainの旧sessionは保存されていても学習read/writeを許可しない。commit応答は再認証を明示し、通常main OAuthを新しく完了してから新owner storeを開始する。今回はproof tokenをmainへ移す追加handoff APIを設けない。
- `enroll_learning_session(expected_account, expected_epoch)` はverified JWT/session/OAuth AMRを再確認し、既存grantがなければ `session.created_at > session_fence_at` かつ `oauth_at > session_fence_at` の新OAuthだけを新epochで登録する。旧sessionのrefreshは同session_id/created_at/古いoauth_atなので、新iatでも常に拒否する。iat/last_sign_in_at/refreshed_atで救済しない。
- `require_learning_context(expected_account, expected_epoch, expected_generation?, write)` を全RLS/全学習RPC/直接SELECT/Storage等へ共通化する。active membership+active owner+live session+一致grant+期待account/epochを毎要求DB照合する。writeはgenerationも要求。headerの値自体は認証でなくDB照合の期待値だけ。
- 旧clientの束縛なし互換は未統合1対1/epoch0のみ。merge完了ownerはheaderなし/旧header/旧JWT/旧queueでreadもwriteも拒否し、JWTをrefreshしてheaderだけ最新版にしてもgrantなしでは入れない。resetのgeneration一致だけをaccount/epochの代用にしない。
- bootstrapは本人の解決状態/再認証要求だけを返し、grant失効時に相手の件数・履歴へアクセスさせない。退会/切離しtombstone・disabled・失効epochを未membershipへ読み替えず、bootstrapで復活させない。未membershipは `onboarding_required` として学習account/state/guest importを自動生成しない。明示createNewだけはintent/fresh legなしで自分の新accountを作れる。取消し/別UID切替/期限切れでもguestへfallbackしない。
- account全体のsession_fenceは新規session自動enrollの下限で、membership epochは個別資格の世代。provider解除等で一部membershipだけを失効する場合は当該membershipにも `session_fence_at` を設け、双方の最大値を使う。統合後の全ログイン方法を黙って削除しない。

## 8. 実装前に潰す重大リスク

| 優先度 | リスク / 必須の確認 |
| --- | --- |
| P1 | membership付替えだけでは旧JWTが相手履歴へ昇格する。全membership epoch、旧grant失効、両proof grant、統合後fresh enroll、直接SELECT/RPC共通fenceを同transaction/同releaseで揃える。 |
| P1 | `auth.sessions`の行存在/getUserだけではGoTrueのtimebox/inactivity/low-AAL等の全判定を証明しない。not_after NULLを無期限と解釈しない。公式refreshによるpolicy確認とSQL live/fence照合を分け、短い正設定・失効・結果不明・credential保存失敗の実経路で所有変更0/1回を確認する。設定/SQL commitの完全原子性は保証しない。未確認ならlive性を保証済みと報告せず、公開gateを止める。 |
| P1 | Auth sessionの一部失効がrow削除以外の設定/最終session選別による場合、row share lockだけで完結しない。新OAuthをsession単位で検証するserver境界＋DBのKAQ fenceと、GoTrue側失効条件との整合を全機微APIで実測する。JWT有効期限まで許可する設計へ黙って弱めない。 |
| P1 | 任意Bearer受付/ブラウザ所有verifierだけでは新sessionを当該intentのOAuthへ束縛できない。Edge保持verifier・server専用ingest nonce・global session UNIQUE・callback CASを全て必須にする。 |
| P1 | exchangeとDB保存は原子的でない。交換結果receiptの短期暗号化保管/unknown時の新leg、最終commit transaction/receiptによる再送収束を実境界テストで確認する。 |
| P1 | 既存学習RPC/直接table RLS/初期化/退会/queueが旧 `auth.uid()` owner前提のまま残れば、fence迂回・retired復活・Auth cascadeで共有データ消失が起きる。全owner経路の移行一覧と検査を親データ契約に対応付ける。 |

## 9. 検証契約（すべて未実行、後続実装のDoD）

実GoTrue v2.198.0/2種OIDC/PostgREST/Postgresを使い、IT/E2EでMock/固定待機/timeout延長を使わない。期待エラーは保存/所属/権限が変化していないDB検査と組にする。

| ID | 操作 / 必須の照合 |
| --- | --- |
| P01 | main Aを保持しsource A/target Bを別PKCE keyでfresh認証。preview/明示同意→一回commit→両SSO再ログインで同一account。名前/メール同一の別人情報はproof前に一切表示なし。 |
| P02 | 片側のみ/偽UID/偽署名/別issuer/aud/期限切れJWT/別session/nonce不一致/OTP・recoveryのみ/同UID2回/別flowのfresh Bearer持込みを拒否。同provider別UIDは所有証明を不当に拒否しない。 |
| P03 | intent前のsessionをrefreshしてiatだけ新しくしたtoken、別sessionのlast_sign_in_at更新、JWT秒境界±1秒、DB NULL時刻/clock差を固定入力で照合。古いsessionのproof成立件数0。 |
| P04 | proof/sessionを別intent/別legへ再送、verifier/code取り違え、二重callback、交換中再送、交換成功後DB失敗、保存前Edge停止、応答喪失を注入。同じreceiptまたは新leg再認証となり、所有移動0/1回を確認。 |
| P05 | TTL/3 attempts/intent active一件/invalid secret/取消し/別UID・別main session切替/古いcallbackを照合。第三者が無効secretで他人のattemptを消費させない。 |
| P06 | preview後の学習write/reset/設定/第三membership追加/解除、A+B対A+C、同intent commit二重送信、commitとcancel競合。state SHARE/UPDATEの待機後binding再検査、全12表の任意列更新によるdigest staleで再preview/再証明、同payloadだけ同receipt、異payloadは拒否。表示値とdigestが同一snapshotであることも照合。 |
| P07 | commit前の両側全session/追加membership session/直接SELECT/旧headerなし/旧queueを、元JWTとrefresh済みJWTの双方で実行。全て相手学習read/write拒否。proof許可sessionと統合後fresh sessionだけ新epochで成功。 |
| P08 | GoTrue local signOut/not_after/timebox/inactivity/low-AAL/失効条件変更とproof/commitが競合。live性に違反したproofを拒否し、実設定でのSQL/GetUser判定の差を記録。 |
| P09 | 未membershipの新OAuth→bootstrap、取消し/期限切れ/並行初回callbackで学習row/guest import/outbox0件。明示createNewは検証済みmain JWTだけでintent/fresh legなしに一accountへ収束し、取消し済み追加intentからは自動作成しない。add-existingは両fresh proof後だけ既存ownerへmembership一件。退会/tombstone/失効epochのbootstrap・createNewによる復活0件。 |
| P10 | private schema/RPC ACL、ingest nonce入手不可、service key/secret/verifier/tokenのURL/GA4/console/serverログ不在、callback query即除去、許可外origin/redirect拒否、main session保持とsignOut scopeを実検査。 |

本設計の完了条件はAPI/状態/期限/障害復旧/session fence/検証入力が具体化していること。実装・実境界検証・公開の完了とは分け、P1未確認をP2へ格下げして公開しない。

## 10. 未割当Auth UIDへの追加（foundationの追加migration前）

公開済みfoundationの`account_intents`はtarget UIDとaccountのNULLを同値にする制約を持つ。上記attachには検証済みtarget UIDだけが存在する状態が必要なので、後続migrationで「target accountがあればUID/epoch必須、accountがなければepochなし、target UID単独はmerge_existingのproof成立後だけ許可」へ変更し、制約名/正常・異常入力を実DB検査する。既存migrationは書き換えない。

targetが未割当の場合も、source/target両fresh proof、最終同意、全既存ownerのfenceとepoch更新、旧session拒否を省略しない。明示createNewとattachを並行させる場合、createNewは対象Auth userを最初にUPDATE lockし、attach側は全Auth user先行SHAREとmembership UNIQUEで直列化する。membership初期集合・proof snapshotを下位lock後に比較し、作成/他方attachが先ならstaleとして全rollbackする。余計なaccountやstateを作って統合のふりをせず、旧target sessionを新ownerへ暗黙enrollしない。

bootstrapはread-onlyなので新OAuth後のgrant作成を兼ねない。`POST enroll_learning_session(expected_account, expected_epoch)`を別の明示操作としてfresh session/OAuthと現在membership/fenceからのみ登録し、成功後にbootstrapを再読する。既存の失効grantはbootstrap/refreshで復活させない。これらの追加DDL/API/競合回帰は未実装であり、bootstrap部品22条件だけをもって完了とはしない。

## 11. 承認済みproof sessionとfresh sessionの区別（未実装）

通常のgrant/enroll/readはsession作成時刻とOAuth時刻が両方とも最大fenceを厳密に超えることを要求する。等値も拒否する。内部read/bootstrapのreviewで境界の不足を検出し、等値拒否の回帰を追加中である。

一方、commitで明示承認した両proof sessionはcommitより前に作られているため、上記fresh判定だけでは許可できない。`reason='proof'`という文字列だけの例外を加えてはいけない。後続migrationでgrantをserverが消費したproof/committed receipt・canonical account・確定後epoch・承認対象fenceに構造的に束縛し、同一session/Auth UID/intent、proof consumed、receipt committed、現在epoch/fenceとの一致を読み取り側でも確認する必要がある。receiptやproofが不一致・未commit・取消し・削除済みなら通常のfresh判定へ黙って切り替えず拒否する。

現在のfoundationにはそのproof/receipt参照を持つgrantがない。非公開read/bootstrap/locking部品は通常のfresh fenceだけを扱い、reasonをproofへ書き換えても迂回させない。承認済みproofの例外は未実装で、将来merge APIの公開前に追加DDL/ACL/正常・偽receipt・別session・旧epoch・次merge/reset/退会の実検査を揃える。mainの学習再開は既定どおり新OAuth再認証であり、proof credentialをbrowserへ渡さない。
