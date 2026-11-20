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
- まず競合説明・元session復帰のPR57を独立して公開する。これは#58の予防・統合・履歴保持の完了ではなく、本Issueは継続する。実アカウントの統合・削除は実行しない。
