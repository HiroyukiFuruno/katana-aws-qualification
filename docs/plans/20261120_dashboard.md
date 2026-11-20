# #24 学習ダッシュボード

一次情報: Issue #24、#23の保存・集計契約、本人の「ログイン後のホーム」「同意したゲストも利用」「ログイン時はCookieとの二重管理なし」。本書は設計準備であり、画面の実装開始は#23公開済み・#25追加改修の公開後とする。Amazonは対象外、SSOはGitHub/Google/Microsoft/Facebookの4種類。

## 着手条件と責務

- [x] #23公開済み（PR63/main22ce5c6）。#25追加改修もPR66/mainc767ac5として公開済み。公開教材indexで12単元・STEP数・目安時間を再確認。
- 集計境界は既存の`learning_summary`のrange/total/byMode/byCategory/daily/exams。回答数を分母とした正答率、実測durationMs、空のaccuracy/meanDurationMs=nullを維持する。
- アカウントは本人のRPC、ゲストは同意した端末の履歴を同じ集計契約へ変換する。ゲストの集計は表示コンポーネントから分離し、共通の固定入力でSQLとの一致を検証する。アカウントの失敗時にゲストへ切り替えない。
- UIは個別の生イベントをページ取得してクラウド集計を作らず、推定合格率・疑似点数・未観測の学習時間を生成しない。

## 画面と状態

- [ ] 冒頭に「アカウントの記録」/「この端末の記録」、集計期間、表示timezone、回答数の分母を明記する。
- [ ] 回答数・正答率・記録済み回答時間の合計と平均を表示する。0件の正答率は未計測表記とし、0%へ置き換えない。
- [ ] 資格/mode/期間（全期間・7・30・90日、既定30日）を一つのrangeへ変換し、全カード・表・グラフへ同じfrom/to/modes/certificationId/timezoneを渡す。UTC半開区間を使用し、読み込み中の古い応答を世代と所有者で棄却する。
- [ ] 分野ごとに回答数・正答数/率・記録時間・出典版/改訂を示し、少数回答の結果を断定的な弱点判定に使わない。
- [ ] 日次の回答数・正答率・回答時間を表示し、グラフと同内容の表を常設する。色やhoverだけへ依存しない。
- [ ] 学習開始・資格別演習・誤答復習・模試履歴へ移動できる。模試のsubmittedAt不明を架空の日付へ置き換えない。
- [ ] loading/error/未同期/成功0件を明確に区別し、retryを用意する。未同期なら保存先と未反映の可能性を説明する。
- [ ] 保存同意のないゲストは説明と学習保存同意/無料登録の導線を表示する。GA4同意を必須にしない。
- [ ] 未ログイン/logout時は公開ホーム、ログイン済みロゴ/ホームは言語付きdashboard、直接URL/再読込もセッション確定後に正しい所有者で表示する。
- [ ] AccountSettingsと連携・退会の導線を保持する。10言語、light/dark、320/390px、keyboard、見出し・表の読み上げを検証する。

## 実行・検証可能な完了条件

- [ ] 実GoTrueの2ユーザーと実Postgresに固定回答を投入し、複数資格/mode/改訂・UTC境界・IANA日境界・空/少数の数値を表示と照合する。ゲスト側も同じ固定入力の期待値へ一致させる。
- [ ] 各フィルタで全指標とdaily/tableが同じ対象を示す。失敗・遅い応答・所有者切替で前ユーザー/前フィルタ結果が復活しない。
- [ ] 4種類SSOの共通callback→dashboard、locale維持、home/direct/reload/logout、ゲスト同意あり/なし、GA4拒否でも端末保存許可を実回帰で確認する。
- [ ] 保護データが静的HTML/sitemap/検索metadata/共有cacheへ出ないことを既存build検査で確認する。
- [ ] 既存check・実integrationを通し、Draft→レビュー回収/指摘修正/reply/resolve→Ready→必須CI→merge→本番反映と公開URL検証を記録する。

本人のMFA/個別同意は独立フォローアップへ記録し、担当側で実行可能な未対応を除外しない。未有効化SSOを一般利用可能とは報告しない。


## 最新のデザイン要求（2026-11-20）

ユーザーは「ダッシュボードは超豪華にして欲しい」と指定。学習推移、資格/分野別の得意不得意、復習対象、模試履歴を、実データに基づくグラフ/ヒートマップ/要約カードと一貫した視覚階層で構成する。十分な余白とタイポグラフィ、mobile/tablet/desktopの密度調整、light/dark、keyboard/focusを作り込む。架空のスコアや推定合格率、ダミー履歴を製品へ入れず、データなし/少数/未同期/失敗でも整った専用状態を用意する。表の代替と実DBの数値照合条件は維持する。

## 追加の必須範囲: 全分析軸とカスタマイズ

- [ ] 資格別・カテゴリ別・学習形式別（通常学習/基礎checkpoint/基礎最終/模試）・期間別・教材改訂別を網羅する。同じ名のcategoryでもsourceVersion/questionRevisionを混同しない。
- [ ] 日次推移（回答数/正答率/記録時間の折れ線・棒）、資格/カテゴリ比較（横棒）、学習形式構成（ドーナツ）、得意不得意（十分な回答数の軸だけレーダー）、活動カレンダー（ヒートマップ）、模試/基礎最終の受験回推移を、実際に記録されたデータで提供する。意味のない種類を水増しせず、各図に数値表・凡例・空/少数状態を備える。
- [ ] 初期配置は過去30日/全資格/全形式/端末IANAtimezone、要約→推移→資格/分野→活動→復習→受験履歴。ユーザーはwidgetの表示/非表示、順序、適合するグラフ種類、期間/資格/形式/timezoneを変更でき、初期設定へ戻せる。keyboardで並べ替えられ、mobileは1列、desktopは密度のあるgridとする。
- [ ] カスタマイズはownerごとのUI設定として保存し、他人の配置を流用しない。会員はアカウントへ、ゲストは許可した端末へ保存する。未同意guestはタブ内のみ。#59の言語/theme/取得資格設定とは混同しない。設定失敗/破損は明示して初期表示に戻す動作を仕様化し、学習記録を消さない。
- [ ] guestの基礎回答は専用GuestLessonSourceをtrusted artifactへ照合して回答イベント/受験回へ派生し、legacy attemptsと重複させない。会員はSQL集計の正本を使い、欠けている分析軸はRPC契約を拡張して同じ固定入力でguestと一致を検証する。

2026-11-20読取調査: 現行learning_summaryはtotal/byMode/byCategory/daily/examsを提供。dashboard UI/厳密view model/owner-filter世代guard/guest基礎回答adapterは未実装。時刻不明をepochで埋めない。上記は計画であり完了証跡ではない。

## 実装中の契約と担当

- [x] 共通型を`src/dashboard/*Types.ts`に固定。詳細は`docs/dashboard-analysis.md`。
- [x] 集計SQL・設定保存SQL・実DB固定入力検査。001–012と既存fixture、新規dashboard fixture、実PostgRESTの10条件一致・2owner・設定競合・reset後の読取回復を確認（`test-results/dashboard/data-recovery.log`）。
- [/] SVGグラフ・カスタマイズ・10言語UIを実装。元の試作図は正式図へ置換済み。全グラフ/全localeのnative確認と未参照試作コードの整理が残る。
- [x] 厳密codec・guest派生/集計・owner/generation guard・設定と画面接続。既存全checkは298単体/2931 assertions、型・重複0・教材・build成功（`test-results/dashboard/check.log`）。
- [ ] 共通固定入力のSQL/guest一致、owner競合、設定retry/衝突、実ブラウザ、既存品質ゲート。
- [ ] Draftレビュー回収/修正/解決、Ready/CI/merge、本番DB/サイト/公開値の照合、Issue Close。

既定は14種類中9widgetを表示、追加を含め20instanceまで。全体条件とwidget条件を別保存し、同一条件の集計RPCは共有する。設定のリセットと学習記録の削除を分離する。現在の単元進捗は期間別回答集計に混ぜず、期間等の非適用を画面へ明記する。

## 検証中の記録

- 実ブラウザの基礎4ケースは`test-results/dashboard/native-core-retry.log`で4/4成功（11.0s）。同意なし/同意guest2回答50%/member2owner分離/設定保存と個別override。390pxの横幅も一致。最初の失敗は同意で画面が切り替わるcheckboxへ`.check()`が再照合し続けた検査で、クリック後に保存同意と集計値を確認する操作へ修正した。30s timeoutは変更していない。
- `test-results/dashboard/check-first-duplication.log`の新規重複2件はenum表示とページ選択を共有部品へ抽出して解消。品質条件を緩めていない。
- Lintの既存14警告は変更外のCSS/既存テストで、今回のファイルから新規警告なし。bundleサイズ警告も既存ゲートを維持し、無効化していない。
- DB世代変更後は読取だけ1回再初期化して回復する。設定書込は自動再演しない。同意済みguestの別タブ設定更新は未編集時だけ再読込し、編集中は競合を案内する。
- ここまでの証跡はローカル検証。Draftレビュー・全native/CI・DB/サイト公開・Issue Closeは未完了。
