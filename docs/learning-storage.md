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

member模試はサーバー時刻と単調時計を使い、端末時計のずれを期限へ反映しない。選択時刻はDBが確定し、UTC文字列の精度を提出まで保持する。保存後の応答喪失は改訂と内容が一致するDB記録だけを採用する。期限後は保存済み回答だけを確定し、同じ提出の再送は同一UUID/payloadを使う。guest模試も同じstoreを使い、未同意のdraft/提出履歴を端末へ書かない。同意済み提出はstore正本へ反映し、通常回答と直列化する。壊れた既存履歴/draftへの上書きを拒否し、原本とエラーを保持する。DB契約は `data-persistence.md`、時計の固定条件は `plans/20261120_exam_clock.md` を参照する。

## 端末データの明示的移行 UI

自動 import はせず、利用者が明示ボタンを押した後だけ実行する。history、profile、模試 draft、旧誤答 index/Cookie ごとに preview、受入/拒否理由、件数照合、元データを削除できる条件を表示する。

- 正常な履歴だけを question catalog の ID と revision に解決して移行候補にする。
- 壊れた行、未解決の資格、復元不能な Cookie ID は理由を示して元の端末データを保持する。
- Cookie/index の ID だけから回答 event を捏造しない。
- 同じ端末原本の再試行、manifest、SHA-256、原子性は DB 正本の移行契約に従う（`data-persistence.md`）。

## 画面状態と reset

保存同意のない guest には、学習保存の説明・同意・無料アカウント導線を出す。loading、保存失敗、未同期、成功した 0 件を互いに区別し、失敗を 0 件や guest fallback として表示しない。

guest の明示 reset は保存同意の撤回後も端末履歴、profile、旧誤答 local storage、旧模試 draft、旧誤答 Cookie を対象にする。専用purgeは学習キーだけを削除し、解析・表示設定を消さない。member reset/退会はクラウド記録の処理であり、同じ端末にある guest 原本を暗黙に削除しない。DB 削除範囲と cascade は `data-persistence.md` を参照する。

## 検査と公開状態

- browser 側の実進捗・移行・reset 検査は `test-results/progress/pr63-release-candidate-progress.log`（25件成功） に記録する。IT/E2E は Mock、固定 sleep、timeout 延長を使わない。
- DB/RPC の実 GoTrue/Postgres/PostgREST 検査、RLS、revision、migration、reset、cascade は `data-persistence.md` の統合検査境界を参照する。
- #25 は main `b767b78` で公開済み。#23 は frontend/outbox/模試の実装・自動検査済み、レビュー・merge・公開検証前であり、保存機能を公開済みとして扱わない。#24 は #23 公開後の後続である。
