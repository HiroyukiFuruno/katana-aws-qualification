# #58 アカウントの分離防止と安全な統合

Issue: https://github.com/HiroyukiFuruno/katana-aws-qualification/issues/58

親Issue: #17
実施順序: #25 基礎学習 → #23 履歴永続化 → #24 ダッシュボード → 本Issue。
ユーザーの2026-11-20指示により、アカウント連携の競合・マージは最後に実施する。原則は若番順だが、この明示順序を優先する。

## 実際に確認した問題

MicrosoftでログインしてGitHubを連携すると一般的なログイン失敗画面になり、逆方向のGitHub→Google/Microsoft連携でも失敗する。GitHub単体・Microsoft単体のログインは成功する。

実callbackの固定エラーは`identity_already_exists`。実DBでは、GitHubだけを持つKAQアカウントとGoogle/Microsoftを持つ別のKAQアカウントに分かれている。名前やメールの一致でこの2件を勝手に同一人物と判断してはいけない。既存セッションが有効でも、現在の画面は一般エラーとログイン入口だけを表示してしまう。

既存アカウントの削除・統合は実施していない。今回の利用者に限って学習記録0件でも、一般機能は双方に履歴が存在する条件で設計する。

## 目的

既存の別KAQアカウントに登録されたログイン方法を安全に扱い、両方の所有を証明した本人が、学習記録を保持して統合できるようにする。新しいSSOの追加と、既存2アカウントの統合を区別する。

## 先に確定する設計

- 認証IDと学習データの所有者を分離する方式を含め、永続化・RLS・退会・セッションと整合する統合方式を選ぶ。
- Supabase公式identity linkingは既存別ユーザーのidentityをそのまま移すAPIではない。公式APIの制約を確認し、auth管理テーブルの直接書換えやアカウント削除を安易な統合手段にしない。
- 元/先の認証方法、所有者の証明、残すデータ、競合時の選択、取消し可能な段階、復旧・監査の契約を物理設計書へ固定する。

## 安全条件

- 氏名・表示名・メールの一致だけで候補を列挙・自動統合しない。同姓同名でも別人は統合できない。
- 利用者の明示開始後、元/先それぞれのSSOを使う新しい認証フローを実施し、両方の所有をサーバーで検証する。クライアント申告のUIDを信用しない。
- 確認は短い有効期限・操作への束縛・一回限りとし、認証失敗/対象変更/別ユーザー切替/期限切れ時は統合しない。
- 最後に統合対象・件数・競合時の扱いを表示して明示確認する。途中失敗・二重実行・同時実行・古い通信で所有権や記録を壊さない。

## 履歴と設定の扱い

- 回答履歴は両側を保持。同一イベントの再送は重複させず、同じIDで異なる内容を黙って捨てない。出典/資格/設問改訂/日時/実測時間を保持する。
- 模試は別受験として保持。途中draftや回答順・締切・提出状態を無条件に混ぜない。
- 取得資格は重複排除。査定回答/学習設定/進行中計画の競合は契約に従って本人が選択できる。
- migration manifest、リセット世代、未同期キューと旧sessionを整合させ、統合前の通信が旧所有者へ記録を書き戻さない。
- ダッシュボードは統合後の一貫した正本から再集計する。どのSSOで再ログインしても同じ記録・設定を扱う。
- 退会とprovider解除は統合後の全認証方法・データへの影響を明確にする。

## 完了条件（担当が実行できる検証）

- [ ] 統合方式と全データ種別の競合・復旧・削除境界を設計し、既存#23/#24の契約と照合する。
- [ ] 実GoTrue/OIDC/DBの2ユーザーで、名前一致だけでは越境できず、片側認証のみ/偽UID/期限切れ/取消し/切替が拒否される。
- [ ] 両側に履歴・設定・模試を持つ固定入力で保持/重複排除/競合選択/再集計を照合する。
- [ ] 正常な統合、再送、並行実行、途中失敗と復旧、RLS、旧token/旧queue、再ログイン、退会を実境界で検証する。
- [ ] 連携競合をログイン失敗と区別し、元のsessionを保持して設定へ復帰できる。全10言語、mobile、keyboardを検証する。
- [ ] 既存check、150行、重複/依存ゲートを維持する。IT/E2EはMock/固定待機/timeout延長なし。
- [ ] Draft→レビュー→指摘修正/reply/resolve→P0/P1ゼロ→Ready→必須CI→merge→公開確認の証跡を記録する。

本人のMFA/実アカウントでの最終確認は非ブロッキングの独立フォローアップに分離する。実行可能な実装・自動検証・公開を除外してCloseしない。

## 既に準備した差分

Draft PR #57に競合説明・session保持/復帰・10言語と実2user回帰がある。74単体/1,155assert、実Auth112件成功、Codex重大指摘なし。今回は公開せず本Issueへ引き継ぐ。これだけでマージ機能の完了とは扱わない。

一次資料: https://supabase.com/docs/guides/auth/auth-identity-linking


## 最新の主対応: アカウント分離そのものを防ぐ

ユーザーの追加指示により、主対応は事後のmergeだけでなく、新しいSSOを利用する時点で既存KAQへ結び付ける予防導線とする。

- 新しいSSOの本人認証後、学習アカウントを新規確定する前に「既存KAQへ追加／新規作成」を選べるようにする。
- 既存KAQへ追加する場合は、そのKAQのSSOでも認証し、両方の所有をサーバー側で確認して同一の学習記録の持ち主へ結び付ける。
- 候補は所有確認できた情報や本人が明示したログイン方法の範囲に限定する。名前・未検証メールで他人のアカウント存在やプロフィールを列挙・漏洩しない。
- OAuth初回認証時に基盤が認証userを作成する動作と、KAQの学習アカウントを確定する段階を区別して設計する。画面だけ同一アカウントに見せ、実保存先が分かれる実装は不可。
- 既に分かれたKAQ/履歴のmergeは復旧対応として引き続き必要。予防導線の取消し/再試行/並行初回認証も検証する。

追加のClose条件:
- [ ] 実2種OIDCで、新SSOの初回利用→既存KAQ所有確認→共通保存先→両SSO再ログインで同じ履歴を表示する実境界回帰を通す。
- [ ] 新規作成を本人が選ぶ場合、候補なし/取消し/期限切れ/別人の同姓同名/メール入力による列挙/並行初回ログインで越境や意図しない分離が起きない。

このIssueは#24完了後に実施し、#25→#23→#24の先行公開を止めない。本人による既存KAQの削除・統合は未承認のまま実施しない。

## 着手時点（2026-11-21）

#23は公開済み、#25/67/68のスライド・操作・設問改版も公開済み。#24はPR71/main `97f31e39e37b7d081d60a514d7ce5b3253a80712`、deployment `dpl_5Laq5vTAKHQRxbumDrmNeAvAAwC4`で公開・実URL検証・Close済み。DBは既存13migration/13table/10学習・dashboard RPC/18教材版。実ユーザーのAuth/学習accountは統合・削除していない。

新worktree/stashは作らず、既存`release/auth-link-conflict`へ公開mainをmerge（60ac128）。元のDraft PR57の競合説明・session保持を維持する。これは本Issue全体の実装完了ではない。

公式調査: `test-results/account-merge/identity-design-research.md`。Auth master `10ef10789d1ee4fb422b448047e67e3e264c0482`の知見は、local GoTrue `v2.198.0`と稼働版へ照合してから採用する。

## 採用する設計の境界

### 学習の所有者

- `learning_accounts.id`を認証ユーザーとは独立した学習owner UUIDにする。`auth.users.id`からmembershipで一意に解決し、一つの学習accountに複数のAuthユーザーを結び付けられるようにする。Auth identityの直接書換え・Auth削除をmerge手段にしない。
- 既存データは1対1で移行し、owner UUIDの値は可能な限り既存値を保持する。Authユーザーが削除されたという理由だけで共有学習記録を失わないよう、全owner FK・RLS・RPC・退会をまとめて設計する。
- クライアントは現在のAuth UIDと学習account ID/membership epoch/DB generationを区別する。RLS/RPCはDBでmembershipとlive sessionを確認する。`user_metadata`や表示メールから権限を導かない。
- 書込と直接読取には期待account/epochを束縛する。HTTP headerで束縛する案は、サーバーで実membershipと照合し、header自体を認証証明にしない。旧client互換は未統合の1対1/epoch0だけに限定し、統合後の未束縛呼出しは拒否する。
- 新SSO認証後のAuthユーザー作成とKAQ学習account作成を分ける。新規/既存への追加を選ぶ前にProgressStoreや学習stateを自動作成しない。bootstrapは自分の状態だけを返し、候補の名前/メール検索APIを設けない。

### 両側の新しいSSO証明

- 所有証明の単位は2つの異なるAuth UID/KAQであり、「必ず異なるprovider種類」という追加制限は設けない。同じAuth UIDに既にあるidentityは既連携として扱う。Supabaseが管理する同UIDのidentity契約と、別KAQ ownerの統合を混同しない。
- 明示開始でサーバーが短命intentを発行し、開始主体・状態・期限・nonce hash・期待membership revisionを束縛する。候補情報は両側の所有証明後にだけ返す。
- 通常ログインのsessionを保持し、proof専用の独立storage/keyを使う公式SDK/PKCEフローで両側を新しく認証する。共通callbackをpurposeで分岐し、独自OAuth署名や認証サーバーを実装しない。秘密nonce/token/verifierをURL・GA4・ログへ出さない。
- サーバーで署名/issuer/audience/expiryが検証されたAuth UID、対応するlive session、intent開始後の新しいOAuth AMRを照合する。新しいJWT iatだけ・refreshだけ・回復/OTPだけでは承認しない。session/proofの別intent再利用と同じUIDの2回提示を拒否する。
- `amr.method=oauth`は実際に使ったsocial provider名を証明しない。previewは所有確認したAuthユーザーとその連携一覧を表示し、「特定のproviderを使った」と未検証の断定をしない。
- intent TTL/試行回数/秒精度とclock skewの具体値は実装前のAPI契約へ固定する。作成時sessionの再提示をproofにせず、目的に束縛した一回限りのreceiptを残す。

### preview・保持・競合

- サーバーが両側の確認済み件数・設定の競合・進行中受験・残す学習accountを表示するpreviewを作る。commit時は同じ両accountを一定順でlockし、data/membership revisionとdigestを再照合する。変更済みなら再previewとし、部分適用しない。
- 回答は両側保持。同一ID/同一内容、同じguest sourceの再取込等の実証できる重複だけを除く。類似する回答や同時刻だけで同一視しない。異内容のID衝突は両保持の新IDと永続した元→先対応表を作り、receipt/session/FKも一致させる。
- 模試・最終テストの別受験を混ぜない。両側のdraftは保持し、続ける受験を明示選択する。単元進捗は同じcontentVersion内だけを扱い、原版の実回答/提出済み合否から整合させる。旧版合格を現行へ移さない。
- 取得資格は安定IDで重複排除し、内容差・査定/配置等の一意設定は本人が選択する。選択前の両原本と出自を保持する。#59/#60で加わる設定/予定も同じowner・競合契約へ追加する。
- migration manifest/receiptの出自を保ち、両KAQへ取込済みの同じguest記録を二重計上しない。全保持件数・hash・参照整合性を確認してからmembershipを切り替える。

### 旧token・未同期・削除

- membershipの付替えだけでは旧Bearer tokenまで他方の履歴へアクセスできてしまう。統合時に両membershipのepochとsession利用条件を更新し、両proofで承認したsessionまたは統合後の新SSOだけを通す。古いsessionをrefreshした新iatでも通さない。
- 旧queueへ新account/epoch/generationを付け直して送らない。確認済みのDB記録と未確認の端末pendingを区別し、旧原文を保持・通知する。統合前に同期できるものは同じ元owner/世代で確認し、統合後の再照合は別の明示操作とする。別端末の未送信を勝手に削除しない。
- 学習resetは一つの学習accountへ適用し、全membershipから同じgenerationを参照する。membership・配置設定は既存のreset境界どおり残す。retired ownerを初期化で復活させない。
- 退会はKAQ全体と現在の認証だけの解除を区別する。全KAQ退会では全membershipを先に拒否し、全学習データ/出自archiveと全対象Authユーザーを確認済みの手続きで処理する。複数Auth削除は原子的でないため、冪等なserver receiptと途中失敗からの再試行を設計する。実利用者の退会をテスト代わりに行わない。
- 同じAuthユーザーの複数identityは公式unlinkを利用する。唯一のidentityしかないAuthユーザーのKAQからの切離しは別操作として明示し、Auth identity削除と称しない。KAQ全体で最後のログインを失わないようaccount lockで直列化する。

## 実施順と検証台帳

- [ ] 既存PR57の競合説明/元session保持を公開mainへ合わせ、単体・実2ユーザーOIDC・10言語を確認する。これだけで#58をCloseしない。
- [ ] 上の設計を現行FK/RLS/RPC/全owner型/退会/実GoTrue版へ対応付け、DDLとAPIの具体契約・全テーブルの保持/競合一覧を固定する。
- [ ] 追加migrationで独立owner/membership/bootstrap/束縛・session fenceを作り、既存13migrationと全既存記録を保持する。
- [ ] proof intent・両fresh OAuth・preview/commit・onboarding・競合選択/出自を実装する。
- [ ] 旧session/queue、同名・メール入力列挙・偽UID・片側・期限切れ・取消し・再送・同時実行・途中失敗/rollbackを実GoTrue/2種OIDC/DBで検証する。
- [ ] 両側の回答・draft/提出済み模試/final・18教材版・資格/設定・manifestを固定入力で保持/重複排除/参照一致/同じdashboardへ照合する。
- [ ] 退会/切離し/最終ログイン保持と全10言語/mobile/keyboard、check・CI・Draftレビュー・公開を完了してCloseする。実ユーザーの統合は未承認であり実行しない。

## 検証基盤の継続事項

PR71のCIは165件=114/51件で成功したが、前半が12.7mに偏った。今後の追加ケースでは15分上限を保って3分割を評価する。`test-results/dashboard/future-3-shards-proof.json`は165=55+59+51、重複/漏れ0。PR71のworkflowは変更していない。Auth164件も9.2mだったため、追加認証回帰の実行時間と全件の集合を確認して必要なら同じ集約gate方式で分割する。検査や対象を削らずtimeoutも延長しない。

test/authの削除関数用Bun imageが1.4.4のまま残っている。packageManager/4 workflowは1.4.5へ更新済みなので、今回のAuth検証に合わせてimageも互換最新へ揃えて全検査する。

## 現行mainへの追従検証

- 稼働Authの`/auth/v1/health`はHTTP200 / `v2.198.0`。local composeの版と一致。公開クライアント用キーによる読取だけを実施し、管理設定・利用者データは変更していない（`test-results/account-merge/production-auth-health.json`）。
- PR57の競合説明を現行mainへ追従し、`bun run check`は327 tests / 3,631 assertions、全lint/format/i18n/重複/構造/教材/build検査に成功（`test-results/auth/issue58-initial-check.log`）。
- 実2ユーザーOIDCの競合回帰は、ダッシュボード刷新前の見出しを期待したため一度失敗した。現行の見出しと未ログイン時の本文内リンクに照合先を直し、再実行1件成功（`issue58-link-conflict-current-retry.log`）。製品コードや待機時間は変更していない。
- PR57はmain `f5afb97667024a7768e8320c94a2414942283f66`で公開済み。deployment `dpl_cq3RNbp4rQFcCAQN8HTmew3WGgzW`の実URLで10言語×4幅/テーマ40条件・keyboard・URL除去・横overflow0/pageerror0を確認した。CIはAuth165件、Progress114+51件成功、最新headのDraft/Readyレビュー指摘0・thread0。これは#58の予防・統合・履歴保持の完了ではなく、本Issueは継続する。実アカウントの統合・削除は実行していない。

## 非公開基盤の段階導入

詳細は[データ保持契約](20261121_account_merge_data.md)と[両側SSO証明契約](20261121_account_merge_proof.md)。既存全12owner表・44SQL関数・Auth/queue/退会の対応を調査し、独立レビューで指摘されたlock順・manifestの相反variant・同一snapshot・複数draftの契約を具体化した。これらは実装予定であり、統合機能の検証成功ではない。

- [x] 実2 issuerのOIDC/GoTrue/Postgres/RESTを同一の専用環境へ接続し、両方の異なるUID/live OAuth session/自己記録だけの読取を確認。従来suiteの別DB成功を統合成功として代用しない。
- [x] 追加migration `202611210004`で非公開10tableのみ追加。全12owner表が非空の状態で、既存public schema/owner/ACL/関数/trigger/index/制約/policy/default ACLと全内容hashが適用前後で完全一致。既存18教材も不変。
- [x] 非公開ACL・RLS・全FK・制約・proof session一回性・intent期限/attemptとAuth単体削除のaccount非cascadeを実DB172検査で確認。匿名/両JWTのprivate REST406、全public/Auth4表の全列hash復元、private空も確認。
- [x] Draftレビュー/必須CI/通常merge/本番DB適用/実API・公開sourceの照合を完了する。既存provider設定と実利用者の統合/削除は対象外。

この段階ではaccountのbackfillもowner cutoverも行わない。新SSO予防導線・proof endpoint・preview/commit・履歴統合・旧token/queue fence・退会は後続差分で揃え、#58はOpenを維持する。

検証追加に合わせProgressの実165件を55/59/51の3分割へ移す。全件の集合・重複/漏れ0と全shard必須の集約gateを確認し、既存15分上限は変えない。Auth用Bun imageもpackageManagerと同じ1.4.5へ揃える。

### ローカル検証とレビュー指摘への対応

- `foundation-populated-final.log` / `integration/foundation-boundary.json`: 14migration適用、12owner表すべて非空。模試draft/提出済み、最新final draft/旧版12問全問正解合格、started/completed manifest、profile/settings等を既存RPCで生成し、適用前後の件数・hash完全一致を確認。合成UIDだけをAdmin APIで削除しAuth404/全12表残0を確認。
- `integration/schema-guards.json`: catalog trigger、table/function/schema owner、column/table/function/default ACL、policy、RLS、index/制約/default/公開objectの追加を実際に変える16ケースがすべて検知され、各変更はrollbackで復元。
- `integration/foundation-proof.json` / `results.json`: 実2issuer・別UID/live OAuth・自己RESTのみ、private172検査成功、Playwright 1件成功。これは統合APIの成功ではなく検証足場と非公開DDLの検査。
- `foundation-complete-check.log`: 全check327 tests / 3,631 assertions、全静的検査/build成功。`foundation-fixture-types-final.log`: 専用fixtureもstrict型検査成功。
- `foundation-data.log`: 実GoTrue/PostgREST/全14migrationと既存DB検査成功。`foundation-auth-deletion-retry.log`: Bun1.4.5の実退会3件成功。
- ローカル全Auth/Progressの試行はセッションの中断で結果未回収。handle消失・該当runner/browser process停止を確認し、ログを`*-interrupted.log`へ保全、残った自分の検証server/containerだけ撤去した。結果を成功として数えず、最新headのCIでAuth全165件・Progress全165件を実行する。
- `progress-3-shards-proof.json`: 現行165件=55/59/51、重複/漏れ/追加0。既存requiredの`progress`集約は全3shard成功が必要。

ローカル検証のP1（移行前が空）とP2（schema比較の不足）を補強した。PRレビュー・CI・本番適用はまだ未完で、完了後に証跡を追記する。

### PR72公開済みの照合

main `2df47b3b6258e868cc5054554a8d603f3f00e2ef` / deployment `dpl_69K8Ya7RKwsvvNQMxYijRx7fR3Fr`。Auth165件、Progress55+59+51件、専用所有権・DB・教材CIすべて成功、最新headのDraft/Readyレビュー指摘0。暗号化バックアップ、実DDLのrollback試行、適用receipt保存、別プロセスの再照合で14registry/公開13表不変/非公開10表空・RLS・ACLを確認した。公開API・ダッシュボード390/1280・スライド4幅の操作と終了を確認。必要なCookieのみの確認では広告0、広告配置の強制高検査は#67の回帰証跡を維持する。Issue58コメント7052663068。実利用者の統合・削除なし。

次の作業は既存checkoutの `release/account-membership`。既知統合済みlocal `release/account-merge` はupstream差の通常削除拒否を受け保持し、強制削除・remote削除・新worktree/stash作成はしていない。

### 内部session検査の部品検証（公開前）

非公開の下書き `supabase/account-merge/session-resolver.sql` と回帰SQLを実2issuer/GoTrue/DBへ接続し、基盤172検査に続いて71検査を通した（`session-resolver-real.json`、23:26:28UTC）。user/session所有・失効・ban/delete・固定期限・第三者OAuth・private ACL・MFA既登録時の機微操作step-upを検査し、Auth原本をrollbackで復元した。最初のfixtureはOAuth client必須列の不足で失敗し、`token_endpoint_auth_method=none`を設定して再検証した。自身の検証container/volumeは終了済み。

これはmigrationにも公開APIにも未接続。hosted設定snapshotの検出・サポート条件、MFAの並行追加、機微操作との競合、owner cutover・proof・merge・旧session/queue・退会は引き続き未完である。実ユーザーの統合・削除はしていない。

### 読取scopeとRLS用ACLの部品検証（公開前）

`owner-scope-real.json`（23:47:27UTC）は実2issuerのAuth sessionを用い142検査成功。claims/header、account/membership/grant/epoch/fence、legacy1:1、RLS本人限定、ACL・全原本rollbackを確認した。`policy-helper-contract.md`は別の実Postgres18.7で21検査を確認し、private schema USAGEなし＋限定EXECUTEで保存済RLSが動くことと、その保護の限界を明記する。

これらはSTABLEな読取snapshot専用である。writer/commitはstate lock待機後に別の最新locking resolverで再検証する必要があり、同じSTABLE関数を再呼出ししただけで競合対策済みと扱わない。Auth delete cascadeとmembership→user lockの逆順候補は未実測・未解決。owner FK/RLS切替・bootstrap/enroll/create・UIへの接続は未実装のまま。

`session-policy-decision.md`には公式Auth policy判定とKAQのDB fenceを分離する案を記録した。hosted inactivityは0.1h=6minも許容されるため、proof10minだけで将来設定を包含すると仮定しない。管理PATをEdgeへコピーせず、公式refreshを限定使用する案と保証境界は、公開APIの実装前に親担当の契約判断・実境界検証が必要。

### bootstrapのread-only部品検証（公開前）

`supabase/account-merge/bootstrap.sql`の本人向け内部関数は、未membership・ready・再認証要求・disabledを分ける。readyだけに本人のaccount/epoch/generationを返し、失効grantへ最新scopeを再交付しない。初回はscope header未取得なのでheaderを所有者選択に使わず、署名検証済みactorとDB grantから導く。active accountのstate不在は不変条件エラーとし、新規account生成へfallbackしない。

`bootstrap-real.json`（2026-11-21T00:48:17.865Z）は実2 OIDC/GoTrue/DBで22条件成功。全14migration・基盤172条件・session71条件・readscope142条件も同じrunnerで再成功し、専用containerは撤去済み。row不変・未割当時作成0・他owner header無効・旧epoch/失効grant/fence拒否を検査した。これは非公開read部品だけで、enroll/create/cutover/ブラウザー接続/全58は未実装のまま。

### Auth policyとlock順の設計判断（実装・公開前）

GoTrue policyはfinal consent後の公式SDKによる各proof sessionの明示refreshと、その後のSQL live/所有権判定へ分離する方針を採る。getUserだけでpolicy確認済みとはしない。leg交換3分・proof/intent最大10分は維持し、refreshで期限やOAuth freshnessを延長しない。refresh開始をCAS保存し、結果不明・credential保存失敗はcommit不可/同token再送不可として当該legをsupersedeし新PKCEからやり直す。管理PATはEdgeへ置かない。hosted設定とSQL commitの完全原子性はこの方式の保証ではなく、その達成と報告しない。single-per-user=trueはmain/proof競合のため未対応であり、設定変更には別の実互換性検証が必要。運用snapshotを毎要求のlive guardと呼ばない。`proof-policy-review.md`の方式案のうち、JS文字列の完全zeroizeやper-record DEKを達成済み/既存要件と読み替えない。暗号化・TTL・terminal失効と削除・ログ非露出の実境界検証を残す。

`auth-delete-lock-contract.md`の実Postgres競合実験は、旧membership先行→Auth user SHAREがAuth DELETE cascadeと循環待機することを確認した。今後のwriter/mergeは全対象Auth UIDを先に昇順SHARE→session→state（通常SHARE/reset・mergeは最初からUPDATE）→account/membership順とし、初期候補UID集合・revisionを下位lock後に最新snapshotで再検査する。集合変更はtransactionを中止し、追加UIDを後取りしない。全writer/cascade/new member競合を含むlocking resolverの実装・統合検査は継続中であり、この最小実験だけで全競合解決済みとはしない。

### 通常検査への接続とfence境界レビュー

内部session/readscope/bootstrap部品を標準`account:integration`の実2 OIDC検査後へ接続した。readscope/bootstrapでfence等値を許可するP1を独立レビューで検出し、`scope-strict-fence-red.log`に再現を残した。比較をstrict `>`へ揃え、account/membershipのsessionのみ等値・OAuthのみ等値・双方等値をすべて拒否する。`scope-strict-fence-green.log`は基盤172/session71/readscope148/bootstrap31/private ACL7条件と実認証1件成功（4.4s）。公開表の全schema・row hashは前後一致、専用DBを撤去した。

private ACL検査は全functionを列挙し、明示REVOKE漏れやPUBLIC EXECUTEを注入したcanaryを検出する。schema default REVOKEがglobal default PUBLIC EXECUTEまで消すとは仮定しない。snapshot読取の二接続検査、全writerへのlocking resolver統合、承認済みproof grantのreceipt/fence束縛、全preview/merge/切替は別の未完条件として維持する。
