# #23 学習記録の永続化

一次情報はIssue #23、親 #17、本人によるAmazon保留・ゲスト利用・Cookie二重管理廃止の指示。#24の画面実装は、本契約の検証・公開後に進める。

## 固定する完了条件

- [ ] ログイン中は本人のPostgresを正本とし、ゲストは学習保存の同意がある端末内だけに永続化する。GA4同意と分け、認証の解決中・失敗時にゲストへ書き込まない。
- [ ] 回答イベントの資格・設問改訂・出典・形式・日時・所要時間を保持し、既存JSONLの形式を維持する。学習Cookieの新規書込みを廃止する。
- [ ] 模試の順序・締切・途中再開・一回提出、取得資格・査定の所有者と競合検出を保つ。
- [ ] event UUIDとpayloadで再送を冪等化し、別内容の同一IDを拒否する。未同期キューを所有者に束縛し、切替・ログアウト・リセット・退会後に再送しない。
- [ ] 古い通信や別端末の書込みがリセット後に記録を復活させない。サーバー世代と期待世代の一致を検証する。
- [ ] 履歴・模試・査定の旧端末記録は明示的に取り込む。manifest、行ID、件数・内容の照合後にだけ原本と旧Cookieを消す。破損・未解決資格・部分失敗は報告して原本を残す。
- [ ] CookieのIDだけから回答イベントを作らない。旧改訂を残し、現行問題の復習対象と区別する。
- [ ] 全テーブル・RPCを未認証と他ユーザーから保護する。退会時に本人のAuth/identity/クラウドデータを削除し、他人・ゲスト記録は消さない。
- [ ] 集計は回答数を分母とする正答率、実測回答時間、mode・資格・分野・日次・改訂・模試を一意に定義する。UTCの半開区間とIANA表示timezone、0件のnull、全期間を扱う。
- [ ] 実GoTrueの2ユーザー以上と実Postgres/PostgRESTでRLS全操作、並行回答・二重提出・再開・失敗再送・移行・リセット・所有者切替・退会cascadeを検証する。IT/E2EのMock、固定待機、timeout増加は禁止する。
- [ ] migration/rollback・バックアップ/保持・無料枠の容量方針を文書化し、既存checkを維持する。
- [ ] Draft → Codex/自己レビュー → 指摘対応/reply/resolve → Ready → CI → merge → SQL/サイト公開 → 実公開検証を完了する。

## 分担と現在地

SQL001〜003は先行PR #51で公開済み。フロント・追加SQL004/005・実検査は既存account-remaining worktreeの`release/account-progress`で統合する。退会基盤は先行公開済み。rootが認証への接続・同意/移行UI・統合レビュー・公開を担当する。本番へのSQL適用はレビューと実DB検査が通過した内容に限定する。

## 2026-11-20 現在の公開順序

- [x] #25 基礎学習: main `b767b78`で公開済み。
- [/] #23 永続化: 実装・実DB/実ブラウザ検査を積み上げ中。レビュー、merge、公開DB適用、本番公開検証は未完了。
- [ ] #24 ダッシュボード: #23のレビュー・公開後に着手する後続。
- [ ] #58 既存履歴のmerge/連携競合: #24後の最後に分離して扱う。#23へmerge機能を追加しない。

保存契約、migration順序、rollback、バックアップ/保持/無料枠の未設定事項と検査証跡は`docs/learning-storage.md`を正本とする。

## 統合レビューの未対応（公開前に必須）

- [x] P1: member未同期queueをowner/サーバー世代に束縛した一時outboxとして保持し、offline→reload→onlineで元UUID/payloadを一度だけ保存。reset/logout/切替/退会で再送停止。他人のoutboxを転送しない。
- [x] P1: 模試の回答save成功・finalize通信失敗後に最新revisionで再提出し、回答イベントと提出を一回に限定する。
- [x] 既存Auth/fundamentals検査を新しい学習保存同意の実UIへ合わせる。検査条件/件数/期待値を削除しない。
- [ ] 修正後に全check・実data/progress/Authを回収し、Draftレビューへ進む。
- [x] P1: 模試提出成功をstore snapshotへ反映し、その後の通常回答で模試履歴を上書き消失させない。finalize→append→購読snapshotの固定回帰を追加する。
- [x] P1: 非同期outbox清掃が遅延したA→B→A切替で、古い遷移が最新storeを上書きしない。遷移取消し/tokenとstop後の無効化を回帰検証する。

統合検証: 実progress15件PASS（after-outboxログ）。全checkは追加UT fixture重複3件で停止したが、共通化で0clonesを回収済。Auth162件PASS（persistence-auth-fullログ）。004は本番未適用。
- [x] P1: offline誤答Wの後で正答Cへ選択変更した際、WのUUID/payloadを固定し、CのattemptNumber/priorIncorrectCountへ既知の先行回答を反映する。
- [x] 調査: 別タブが同一問題・同一選択を別UUIDで回答した正当な複数イベントを、outbox復元時に破損として拒否しない。

最終候補の検査: `persistence-clock-final-check.log` 全155 unit/1369 assertions、重複0、build成功。`persistence-clock-full-progress.log` 実19件成功（再移行・時計ずれ・期限切れ・応答喪失を含む）。`test-results/data/exam-clock-integration.log` 実DB/RPC成功。004/005は未適用、レビュー・公開は継続中。

- [x] 最終review P1: confirmed保存の期限跨ぎ拒否後、同じrevisionの確認済みDB draftへ切替して採点する。期限前/他エラー/別exam/競合は成功扱いしない。

最終review修正後: check157件/1371 assertions、実progress20件、実Auth162件成功。`test-results/progress/persistence-reviewed-check.log` / `persistence-clock-complete-progress.log` / `persistence-reviewed-auth.log`。レビュー指摘P0/P1ゼロを再確認。Draft/CI/merge/公開は後続工程。
