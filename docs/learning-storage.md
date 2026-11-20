# 学習記録の画面・端末保存契約

この文書は #23 の frontend、guest 端末保存、再送キュー、移行 UI の責務を記録する。Postgres schema、所有者/RLS、RPC、migration、hash、集計式の正本は [data-persistence.md](data-persistence.md) である。両者を同じ契約として重複記載しない。

## 保存先と同意

- ログイン中は画面を account の記録として扱い、guest local storage と混ぜない。DB の所有者境界と RPC は `data-persistence.md` を参照する。
- guest は `katana.learning-progress-consent.v1=granted` を明示した端末だけに履歴と profile を保存する。同意なしの guest 書込みは現在のページのメモリ内だけに留める。
- 学習保存同意は Cookie、GA4、広告、認証と独立する。学習保存を許可しても分析/広告を有効化しない。認証解決中・失敗時に member と guest の保存先を切り替えない。
- account のクラウド記録と guest の端末記録は別のデータ源として表示し、未認証でクラウド個人データを読まない。

## frontend の記録と再送

回答は既存の NDJSON/JSONL 形式（1行1回答）を維持し、question ID/revision、source version、category、format、mode、回答時刻、所要時間などを codec で扱う。現在の演習・履歴出力は本人の回答履歴を取得する。後続 #24 のダッシュボードは widget ごとの生イベント全件取得を避け、member は DB aggregate、guest は同じ数値契約へ変換した端末履歴を使う設計とする。

member の再送キューは owner と generation に束縛し、ログアウト、owner 切替、reset、退会後の古い操作を送らない。保存失敗は UI で可視化し、同じ logical event を再送できる。durable outbox はリロード後も元UUID/payloadを保持する。Web Locksで複数タブの更新を排他化し、別タブの正当なイベントを失わない。世代が古いイベントだけを破棄し、保存済みの前段イベントは後段の失敗でも画面へ反映する。

member模試はサーバー時刻と単調時計を使い、端末時計のずれを期限へ反映しない。選択時刻はDBが確定し、UTC文字列の精度を提出まで保持する。保存後の応答喪失は改訂と内容が一致するDB記録だけを採用する。回答保存のACK待ち中は選択・見直し・移動・提出を無効化し、期限後の自動提出も保存終了後に評価する。期限後は保存済み回答だけを確定し、同じ提出の再送は同一UUID/payloadを使う。guest模試も同じstoreを使い、未同意のdraft/提出履歴を端末へ書かない。同意済み提出はstore正本へ反映し、通常回答と直列化する。壊れた既存履歴/draftへの上書きを拒否し、原本とエラーを保持する。DB契約は `data-persistence.md`、時計の固定条件は `plans/20261120_exam_clock.md` を参照する。

## 端末データの明示的移行 UI

自動 import はせず、利用者が明示ボタンを押した後だけ実行する。history、profile、模試 draft、旧誤答 index/Cookie ごとに preview、受入/拒否理由、件数照合、元データを削除できる条件を表示する。

- 正常な履歴だけを question catalog の ID と revision に解決して移行候補にする。
- 壊れた行、未解決の資格、復元不能な Cookie ID は理由を示して元の端末データを保持する。
- Cookie/index の ID だけから回答 event を捏造しない。
- 同じ端末原本の再試行、manifest、SHA-256、原子性は DB 正本の移行契約に従う（`data-persistence.md`）。

取込の成功・部分成功・例外後も、同じowner/storeのクラウド正本を再取得する。通常回答と再取得を履歴ロックで直列化し、ready・更新中でないこと・読込失敗なしを確認してから完了を示す。取込後の取得資格/査定revisionは次の保存へ反映する。

## 画面状態と reset

保存同意のない guest には、学習保存の説明・同意・無料アカウント導線を出す。loading、保存失敗、未同期、成功した 0 件を互いに区別し、失敗を 0 件や guest fallback として表示しない。

guest の明示 reset は保存同意の撤回後も端末履歴、profile、旧誤答 local storage、旧模試 draft、旧誤答 Cookie を対象にする。専用purgeは学習キーだけを削除し、解析・表示設定を消さない。member reset/退会はクラウド記録の処理であり、同じ端末にある guest 原本を暗黙に削除しない。DB 削除範囲と cascade は `data-persistence.md` を参照する。

## 検査と公開状態

- browser 側の実進捗・移行・reset 検査は `test-results/progress/pr63-complete-import-pending-progress.log`（27件成功） に記録する。IT/E2E は Mock、固定 sleep、timeout 延長を使わない。
- DB/RPC の実 GoTrue/Postgres/PostgREST 検査、RLS、revision、migration、reset、cascade は `data-persistence.md` の統合検査境界を参照する。
- #25 は main `b767b78` で公開済み。#23 は frontend/outbox/模試の実装・自動検査済み、レビュー・merge・公開検証前であり、保存機能を公開済みとして扱わない。#24 は #23 公開後の後続である。

追加移行・並行操作の検証: `test-results/progress/pr63-normalization-profile-check.log` は174 unit/1423 assertions成功、`pr63-normalization-profile-progress-final.log` は実29件成功。旧ISO-Z日時とDB offset日時、旧tuple keyとDB参照object keyを同値照合し、回答/flag/選択時刻を持つ模試の取込・原本削除・再開まで確認した。模試・資格/査定は保存ACKまで変更を無効にし、古い改訂での並行保存を防ぐ。本番004/005とfrontendの公開は引き続き未実施。

ゲスト旧プロフィールの互換性: 旧取得資格IDはmember移行と共通の現行IDへ正規化し、保存同意の変更時にstoreと画面のprofileを再同期する。`pr63-guest-profile-sync-check.log` は176 unit/1429 assertions、`pr63-guest-profile-sync-progress.log` は実30件成功。これは公開前検証の記録であり、最新の公開証跡はIssue #23へ記録する。

複数guest tabは既存のhistory lock内で最新のcanonical履歴から追加分を作り、古いsnapshotの共通prefixを再保存しない。同じ内容でも別の回答操作は保持し、同一模試の再提出だけをexam IDで一回にする。移行後のexam通知は通常回答/プロフィール更新と分離し、同じ模試位置の再取得では計測中の時間を保持する。公開前検証は `pr63-guest-import-release-check.log`（182 unit/1440 assertions）と `pr63-guest-import-progress.log`（実31件）、最終timer調整後の `pr63-guest-import-clock-final.log`（対象5件）。

保存同意のwithdraw時は、保存済み模試のactive表示を中断し元データを保持する。再同意時はreloadなしで元回答/flagを復元する。同tab/別tabのnative storage eventとも同じexam source切替通知を使う。最新公開前検証は `pr63-consent-tabs-check.log`（182 unit/1443 assertions）と `pr63-consent-tabs-progress.log`（実33件）。

模試の通常saveもconfirmed response喪失後に同ID/rev+1/対象位置/内容の全照合で復旧する。startは待機中guardとserver draft確認で連打/曖昧な再試行を処理する。既存の「再試行」はreset/profileの失敗後も最新epoch/revisionへ再同期する。公開前最新検証は `pr63-exam-recovery-final-check.log`（187 unit/1464 assertions）、`pr63-exam-recovery-progress.log`（実35件）。


提出済み模試の結果表示用キャッシュは、同じexam IDのsubmitted sessionと全問題/回答を照合できる場合に限り、追加の学習行を作らず整理する。監査は同じsource nameのschema version 2、`completed-exam-cache-v2:`を含めたfingerprint、宣言0行のmanifestとし、旧started manifestを改変しない。元rawの不変と現在ownerを削除直前に確認し、競合・不完全・未知原本は保持する。公開前の追加checkは `pr63-completed-cache-check.log`（188 unit/1466 assertions）。

#25は新しいスライド学習・途中チェック・合格判定の指示により再Openした。上記の公開済み記載は教材本文整備の成果であり、追加の学習フローが公開済みという意味ではない。#23公開後にこの追加改修を行い、その後#24へ接続する。

追加の実認証/DBブラウザ検査は `pr63-completed-cache-progress.log`（37件成功、1.3分）。submitted cacheの新規学習行0と旧started manifest保持、原本削除、再読み込み後2件の正本を確認した。

移行のquestion resolverはindex/bankの失敗Promiseだけを除去し、同じ画面で通信復旧後に再試行できる。成功とinflightは共有し、元の読込エラーは利用者へ返す。`pr63-catalog-retry-check.log`（191unit/1475assertions）で失敗後の再取得と並行共有を検証。実37件の最新差分回帰はCIへ記録する。
