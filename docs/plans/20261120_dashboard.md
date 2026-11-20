# #24 学習ダッシュボード

一次情報: Issue #24、#23の保存・集計契約、本人の「ログイン後のホーム」「同意したゲストも利用」「ログイン時はCookieとの二重管理なし」。#23・#25追加改修の公開を確認して実装・検証中。Amazonは対象外、SSOはGitHub/Google/Microsoft/Facebookの共通契約を維持し、Facebookの一般公開は独立した外部手続きとして追跡する。

## 着手条件と責務

- [x] #23公開済み（PR63/main22ce5c6）。#25追加改修もPR66/mainc767ac5として公開済み。公開教材indexで12単元・STEP数・目安時間を再確認。
- 集計境界は既存の`learning_summary`のrange/total/byMode/byCategory/daily/exams。回答数を分母とした正答率、実測durationMs、空のaccuracy/meanDurationMs=nullを維持する。
- アカウントは本人のRPC、ゲストは同意した端末の履歴を同じ集計契約へ変換する。ゲストの集計は表示コンポーネントから分離し、共通の固定入力でSQLとの一致を検証する。アカウントの失敗時にゲストへ切り替えない。
- UIは個別の生イベントをページ取得してクラウド集計を作らず、推定合格率・疑似点数・未観測の学習時間を生成しない。

## 画面と状態

- [x] 冒頭に「アカウントの記録」/「この端末の記録」、集計期間、表示timezone、回答数の分母を明記する。
- [x] 回答数・正答率・記録済み回答時間の合計と平均を表示する。0件の正答率は未計測表記とし、0%へ置き換えない。
- [x] 資格/mode/期間（全期間・7・30・90日、既定30日）を一つのrangeへ変換し、全カード・表・グラフへ同じfrom/to/modes/certificationId/timezoneを渡す。UTC半開区間を使用し、読み込み中の古い応答を世代と所有者で棄却する。
- [x] 分野ごとに回答数・正答数/率・記録時間・出典版/改訂を示し、少数回答の結果を断定的な弱点判定に使わない。
- [x] 日次の回答数・正答率・回答時間を表示し、グラフと同内容の表を常設する。色やhoverだけへ依存しない。
- [x] 学習開始・資格別演習・誤答復習・模試履歴へ移動できる。模試のsubmittedAt不明を架空の日付へ置き換えない。
- [x] loading/error/未同期/成功0件を明確に区別し、retryを用意する。未同期なら保存先と未反映の可能性を説明する。
- [x] 保存同意のないゲストは説明と学習保存同意/無料登録の導線を表示する。GA4同意を必須にしない。
- [x] 未ログイン/logout時は公開ホーム、ログイン済みロゴ/ホームは言語付きdashboard、直接URL/再読込もセッション確定後に正しい所有者で表示する。
- [x] AccountSettingsと連携・退会の導線を保持する。10言語、light/dark、320/390px、keyboard、見出し・表の読み上げを検証する。

## 実行・検証可能な完了条件

- [x] 実GoTrueの2ユーザーと実Postgresに固定回答を投入し、複数資格/mode/改訂・UTC境界・IANA日境界・空/少数の数値を表示と照合する。ゲスト側も同じ固定入力の期待値へ一致させる。
- [x] 各フィルタで全指標とdaily/tableが同じ対象を示す。失敗・遅い応答・所有者切替で前ユーザー/前フィルタ結果が復活しない。
- [x] 4種類SSOの共通callback→dashboard、locale維持、home/direct/reload/logout、ゲスト同意あり/なし、GA4拒否でも端末保存許可を実回帰で確認する。
- [x] 保護データが静的HTML/sitemap/検索metadata/共有cacheへ出ないことを既存build検査で確認する。
- [x] 既存check・実integrationを通し、Draft→レビュー回収/指摘修正/reply/resolve→Ready→必須CI→merge→本番反映と公開URL検証を記録する。

本人のMFA/個別同意は独立フォローアップへ記録し、担当側で実行可能な未対応を除外しない。未有効化SSOを一般利用可能とは報告しない。


## 最新のデザイン要求（2026-11-20）

ユーザーは「ダッシュボードは超豪華にして欲しい」と指定。学習推移、資格/分野別の得意不得意、復習対象、模試履歴を、実データに基づくグラフ/ヒートマップ/要約カードと一貫した視覚階層で構成する。十分な余白とタイポグラフィ、mobile/tablet/desktopの密度調整、light/dark、keyboard/focusを作り込む。架空のスコアや推定合格率、ダミー履歴を製品へ入れず、データなし/少数/未同期/失敗でも整った専用状態を用意する。表の代替と実DBの数値照合条件は維持する。

## 追加の必須範囲: 全分析軸とカスタマイズ

- [x] 資格別・カテゴリ別・学習形式別（通常学習/基礎checkpoint/基礎最終/模試）・期間別・教材改訂別を網羅する。同じ名のcategoryでもsourceVersion/questionRevisionを混同しない。
- [x] 日次推移（回答数/正答率/記録時間の折れ線・棒）、資格/カテゴリ比較（横棒）、学習形式構成（ドーナツ）、得意不得意（十分な回答数の軸だけレーダー）、活動カレンダー（ヒートマップ）、模試/基礎最終の受験回推移を、実際に記録されたデータで提供する。意味のない種類を水増しせず、各図に数値表・凡例・空/少数状態を備える。
- [x] 初期配置は過去30日/全資格/全形式/端末IANAtimezone、要約→推移→資格/分野→活動→復習→受験履歴。ユーザーはwidgetの表示/非表示、順序、適合するグラフ種類、期間/資格/形式/timezoneを変更でき、初期設定へ戻せる。keyboardで並べ替えられ、mobileは1列、desktopは密度のあるgridとする。
- [x] カスタマイズはownerごとのUI設定として保存し、他人の配置を流用しない。会員はアカウントへ、ゲストは許可した端末へ保存する。未同意guestは履歴・設定を読み込まず、保存同意と無料登録を案内する（Issue #24の保存境界）。#59の言語/theme/取得資格設定とは混同しない。設定失敗/破損は明示して初期表示に戻す動作を仕様化し、学習記録を消さない。
- [x] guestの基礎回答は専用GuestLessonSourceをtrusted artifactへ照合して回答イベント/受験回へ派生し、legacy attemptsと重複させない。会員はSQL集計の正本を使い、欠けている分析軸はRPC契約を拡張して同じ固定入力でguestと一致を検証する。

2026-11-20読取調査: 現行learning_summaryはtotal/byMode/byCategory/daily/examsを提供。dashboard UI/厳密view model/owner-filter世代guard/guest基礎回答adapterは未実装。時刻不明をepochで埋めない。上記は計画であり完了証跡ではない。

## 実装中の契約と担当

- [x] 共通型を`src/dashboard/*Types.ts`に固定。詳細は`docs/dashboard-analysis.md`。
- [x] 集計SQL・設定保存SQL・実DB固定入力検査。001–012と既存fixture、新規dashboard fixture、実PostgRESTの10条件一致・2owner・設定競合・reset後の読取回復を確認（`test-results/dashboard/data-recovery.log`）。
- [/] SVGグラフ・カスタマイズ・10言語UIを実装。元の試作図を正式図へ置換し、未参照の試作4ファイルを整理。全グラフの数値確認8件と全locale/操作15件は成功。全体回帰・レビュー・公開は未完了。
- [x] 厳密codec・guest派生/集計・owner/generation guard・設定と画面接続。既存全checkは298単体/2931 assertions、型・重複0・教材・build成功（`test-results/dashboard/check.log`）。
- [x] 共通固定入力のSQL/guest一致、owner競合、設定retry/衝突、実ブラウザ、既存品質ゲート。
- [x] Draftレビュー回収/修正/解決、Ready/CI/merge、本番DB/サイト/公開値の照合、Issue Close。

既定は14種類中9widgetを表示、追加を含め20instanceまで。全体条件とwidget条件を別保存し、同一条件の集計RPCは共有する。設定のリセットと学習記録の削除を分離する。現在の単元進捗は期間別回答集計に混ぜず、期間等の非適用を画面へ明記する。

## 検証中の記録

- 実ブラウザの基礎4ケースは`test-results/dashboard/native-core-retry.log`で4/4成功（11.0s）。同意なし/同意guest2回答50%/member2owner分離/設定保存と個別override。390pxの横幅も一致。最初の失敗は同意で画面が切り替わるcheckboxへ`.check()`が再照合し続けた検査で、クリック後に保存同意と集計値を確認する操作へ修正した。30s timeoutは変更していない。
- `test-results/dashboard/check-first-duplication.log`の新規重複2件はenum表示とページ選択を共有部品へ抽出して解消。品質条件を緩めていない。
- Lintの既存14警告は変更外のCSS/既存テストで、今回のファイルから新規警告なし。bundleサイズ警告も既存ゲートを維持し、無効化していない。
- DB世代変更後は読取だけ1回再初期化して回復する。設定書込は自動再演しない。同意済みguestの別タブ設定更新は未編集時だけ再読込し、編集中は競合を案内する。
- ここまでの証跡はローカル検証。Draftレビュー・全native/CI・DB/サイト公開・Issue Closeは未完了。

- 最新`test-results/dashboard/final-check.log`: 300単体/2948 assertions、既存品質ゲートと全route build成功。`dependencies.log`で直接・推移依存/lockfileを確認、`bun outdated`に更新候補なし、`dependency-audit.json`は検出0。
- `native-final-layout.log`でグラフ数学・基礎合否・owner等8件成功。localeテスト10件は非表示のoptionと指標spanを同時選択したテストの誤りで失敗。商用コードやtimeoutを変えずselectorを限定し、`native-layout-interactions.log`で15/15成功（41.8s）。10言語×320/390px×light/dark、同種widget追加/保存/reload、keyboard上下移動/フォーカス、未回答単元filter、本人キューの未同期/破損/他人・ゲスト分離を実検証。ja390の明暗とde320スクリーンショットを確認。
- 基礎の未同期キューは読み取りだけとし、DB集計へ加算・再送・削除しない。破損/未来世代/保存領域アクセス失敗は明示する（`scripts/dashboard-pending.test.ts`、上記real native）。

- 全Progress140ケース: `progress-full.log`139成功/1失敗。削除テストのCookieバナー遮蔽をtraceで特定し、必要なもののみを選ぶ操作へ修正。`account-deletion-retry.log`で実handler/cascade成功（2.8s、全体8.2s）。
- 全Auth164ケース: `auth-full.log`159成功/5失敗。削除2件は同じバナー遮蔽、残り3件はguest dashboardにもログインボタンがあるという旧期待値だった。製品コードをテストに合わせず、実際のguest表示・無料登録への遷移を検証する契約へ修正。`auth-targeted-retry.log`7成功（15.1s）と`auth-lifecycle-retry.log`2成功（6.9s）で該当箇所を回帰。
- 最終品質ゲートは`pre-pr-check.log` exit0。レビュー/CIで全件の再実行・公開確認を残す。
- 最新ユーザーFBのスライド終了・checkpoint再訪は独立Issue #67として先行修正する。#24の検証済み差分を正式な作業ブランチのコミットへ保持し、新規worktree/stashは作成しない。本Issueは未完了のまま維持する。

## #67/#68公開後の継続（2026-11-21）

#67/PR69はcd4cb39、#68/PR70はae346acとして本番公開・Close済み。release/dashboardへ公開mainを統合（6759c2e）。未公開の001011/001012だけを210002/210003へ変更し、公開済み001010/210001は不変。

- [/] ゲストの旧版回答が分析から漏れる問題を3件REDで再現し、recognized editions全18pairを重複なく読み取るよう修正。旧16回答/受験は集計、新版の単元進捗は0。未知版は原文保持・除外件数表示、通信失敗は明示。archived-guest-green.log:7件29assertions成功。
- [/] 復習リンクも記録のcontentVersionを保持。editions-navigation.log:2件9assertions成功。
- [x] editions-native.log: 実guest/memberの旧版16回答/合格と新版未学習、10locale×mobile/tablet/desktop×明暗（80条件）を12件/1.0mで成功。
- [x] after-editions-check.log: 全check/build成功、数値はログ参照。
- [x] 全Auth/Progress/data回帰、Draftレビュー/CI、本番backup/SQL/サイト/公開検証。private公開guardは新しい11本baseline・18catalogに更新してから使う。

- 表示密度を目視レビューし、最初のグラフがPCの初期viewportに入らない問題を厳密検査へ追加。compact-native-red.logは5成功/10失敗（1.9m）、比率0。widget設定を見出し横、全体設定を保存状態と同じtoolbarへ移し、0.1以上のグラフ表示比率を維持して再検証する。検査閾値やtimeoutは変更しない。
- compact-check.log: 321単体/3616assertionsと全check/build成功。toolbar調整後の再checkと実native回収は未完了。

- compact-half-viewport.log: 最初のグラフがtablet/desktopの初期viewportに50%以上入る条件でも、10locale/明暗/80画面＋keyboard/設定操作＋旧guest/memberの15件が1.1mで成功。compact-half-check.logは321単体/3616assertionsと全品質・build成功。viewport基準を0.1から0.5へ強化し、timeoutは不変。ja768dark/ja1280lightの新しいスクリーンショットも確認した。
- 全体回帰の現在の分母は165件（all-progress-tests.txt）。after-merge-progress-full.log / after-merge-auth-full.logは実行中であり、成功として扱わない。公開helperのbaselineを11migration/12table/18catalog、追加を210002/210003とし、全13table/10RPC/旧18catalogの全行保持を照合するよう更新。release-helper-selftest.logは正例1/異常18/guard5成功、本番操作は未実施。

## 公開前の契約レビューと修正

- after-merge-auth-full.log: 実Auth164件/4.2m、after-merge-progress-full.log: 実学習165件/7.8mとも成功（対象4153f0b）。
- HighのDB/保存契約レビューでP1を1件発見: 再初期化後に遅れた同owner旧世代成功応答を受け取り、初期化も重複していた。generation-race-red-complete.logで4件失敗を再現。generation/epochの前後照合と共有初期化、readだけ1回回復・write非再演へ修正。既に表示済みの別widgetも残らないよう、実世代変更だけをobservable revisionとして全data cycleへ通知する。dirtyな設定は保持する。
- generation-race-green.log: 関連9単体/27assertions成功。generation-observer-real-db.log: 実GoTrue/PostgRESTの成功1回答を配達だけ保留→実reset→0回答取得→旧応答解放後も0、初期化2回/全カードinvalidate1回、全13migration・既存fixturesも成功。サービス/DBをMockにしていない。
- generation-observer-check.log: 最新全品質ゲート/build成功。レビュー再確認で未対応P0/P1=0（test-results/dashboard/contract-review.md）。最新Dashboard全native回収・Draft/Codex・CI・本番は未完了。

## 公開完了（2026-11-21）

PR71/head590f28c6a0f1ba6233049124ce09dc88a8970805をDraft自己/High/Codex→P1修正/再確認→Ready/再review指摘0→全CIでmain97f31e39e37b7d081d60a514d7ce5b3253a80712へmerge。CI326単体3628assertions、Auth164/9.2m、Progress114+51=165/前半12.7m、部品27/297、data/glossary成功。

本番はproduction24-backup.jsonの新規nonce AES256GCM/復号確認後210002/003のみ適用。管理API roles文字列と配列の表現差による私用検証器の誤判定を修正し（正例2/異常21/guard5）、SQL再適用や権限緩和なしで13registry/13tables/10RPC/全18catalogの全行保持・旧policies不変・既存件数減少なしを照合。production24-smoke-db.jsonはレビュー済み実SQL/RLS/数値/CAS/reset/退会cascadeをrollbackしtempAuth/catalog/public行すべて0。

Deployment dpl_5Laq5vTAKHQRxbumDrmNeAvAAwC4 / customdomain READY・正しいmainを照合。production24-qa.jsonは公開390/1280pxともpassed（20:56:54UTC）、未同意時widget0、18回答15正解83.3%/139秒、全14widgetとradar/boxの実幾何、保存/reload、横幅/ブラウザエラー/guestからmemberAPI送信0を確認。検査は隔離ブラウザ内だけで実利用者データを変更せず。Issue24を20:58:56UTCにcompletedでClose。本人実機は非ブロッキングの別フォローアップ。

local release/dashboardを安全削除しremote保持。既存3worktree/stash0/main97cleanを維持し、既存release/auth-link-conflictへmainを統合して#58へ移った。#58/#59/#60/#22は未完了。
