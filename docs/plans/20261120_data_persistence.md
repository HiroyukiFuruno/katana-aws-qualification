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

## PR #63 のレビュー・CI指摘（公開前に必須）

- [x] P1（Codex comment4638259488）: ゲスト模試のstart/read/save/submitを同意付きrepositoryへ統一する。未同意のdraft・回答・履歴はreload後に残さない。同意時は再開できる。
- [x] P2（Codex comment4638259493、既存保存契約に影響するため採用）: ゲスト模試提出をstore正本へ反映し、次の通常回答で模試や事前履歴を消したり重複させたりしない。
- [x] CI: member模試のDB提出済みを確認した直後に通常回答を始めても、finalize後reloadとappendの競合でsnapshotの15件が1件へ減らない。画面だけでなくDBとstoreの対応を固定回帰で検証する。
- [x] CI: 移行の行受付は最終照合・原本削除の完了ではない。原本削除確認は完了をpollし、既存の削除条件・期待値を維持する。

CI run44670238002は18成功/2失敗。ローカル20成功とは環境・処理速度が異なる実失敗として扱い、成功へ言い換えない。PRはDraftを維持し、修正・再検査・各threadへのreply/resolve後にレビューを再回収する。

追加の統合結果: `pr63-guest-and-race-full-progress.log` は22成功/1失敗。guest模試3件とmember模試再送2件は成功したが、guest resetで旧誤答indexだけ残留し修正中。

- [x] P1: retryPendingの再読込み中に通常回答がACKされたとき、古いinitialize結果でその回答を消さない。`scripts/progress-initialize-race.test.ts` で期待2件/実際1件をRED再現。古い成功/失敗応答の棄却を操作世代またはsnapshot更新で検査する。
- [x] 退行防止: guest模試のstart/update/submitで最新の同意対応repositoryを読み、別draftやreset後の古いcomponent状態を上書き保存しない。旧canonical ID確認を維持する。
- [x] guest store resetへ移した旧誤答indexの削除を補完し、member resetがguest原本を保持する既存期待値も維持する。

- [x] 新guest提出の退行防止: 保存失敗後に回答を変更した場合、改訂未定義のguest draftを旧prepared/cacheと同一扱いせず変更後の回答で採点する。同一内容の再試行はdurationを二重加算せず、memberの同改訂immutable再送も維持する。

最終修正後の実測: `test-results/progress/pr63-final-stable-check.log` は166 unit / 1399 assertions、重複0、型/構造/教材/build成功。`pr63-final-stable-progress.log` は実24件成功。native localStorage quotaを実際に満たした保存失敗→選択変更→再提出を含み、Mock/固定待機/timeout延長はない。元のguest同意切替後の履歴回帰は`progress-guest-consent.test.ts`へ同名・同期待値で復元した。時間計測は最終save/prepare成功時に基点を更新し、失敗後の新選択で前区間を再加算しない。レビュー修正のpush/reply/resolveと新headのCIは次工程。

- [x] 最終review P1: 同意撤回後の明示guest resetでも過去の保存済みhistory/profile/旧誤答index/legacy・prefix examを消し、再同意/reloadで復活させない。解析/表示設定など無関係キーとmember reset時のguest原本を保持する。旧global cleanupからstoreへ移した退行として修正・実回帰を追加する。

撤回後resetの修正・再レビュー後: `pr63-purge-final-check.log` 全168 unit / 1405 assertions、重複0、型/構造/教材/build成功。`pr63-release-candidate-progress.log` 実25件成功。9e12b74のCIではguest再開が正しく第1問/選択/flagを復元しているartifactを確認したが、途中setupを待つ誤ったtest helperで失敗した。resume箇所は最終画面/DB状態を待つよう修正し、初回setupと全件の最終期待値は維持した。追加P0/P1なしを再レビューで確認。

## Codex追加レビュー（942f233/f00134a）の採用P2

- [x] PRRT_kwDOVzQ52c6510xY / comment4638599221: 取込が別repositoryへ書いた後、成功・部分成功・例外後もcaptured owner/storeをrefreshする。再読込み前に完了UIを出さず、履歴/試行数・profileRevisionを次の保存へ反映する。owner切替で他storeへ触れない。
- [x] PRRT_kwDOVzQ52c6510xa / comment4638599227: 保存待ち中の通常の複数選択/移動で同じrevisionを並行使用しない。ACKまで選択/flag/clear/移動/提出をbusy+disabled、同一frame ref guard、期限自動提出はsave終了後に評価。実HTTP応答hold/releaseで検査する。

いずれも既存の保存契約と通常操作に影響するため今回対応し、機能範囲は変えない。f00134aの4 CIは全成功（auth10m1s/data45s/glossary1m8s/progress2m45s）だが、上記修正は未commit/未pushであり、そのheadの完了とは扱わない。

追加P2修正後: `pr63-import-and-pending-check.log` 169 unit/1409 assertions・重複0・型/構造/教材/build成功。`pr63-complete-import-pending-progress.log` 実27件成功。profile取込→reloadなし資格変更→revision/earned更新、partial取込直後の次回答、実PostgREST応答hold→UI busy/disabled→複数選択ACK→next/reload保持を確認。採点statusは本来のquestion-title領域を検査し、取込完了statusで代用しない。read-only再レビューで元P2解消・新P0/P1なし。

## Codex追加レビュー（900b78f時点の対応）

- [x] comment4638649399: 旧producerのISO Z日時とDBのoffset日時を同一時点として照合し、不正日時を拒否する。producer形式の実データを使った取込・照合・原本削除を検証する。
- [x] comment4638649404: 旧draftのarray question keyとDB ref-object keyを既存codecで正規化して照合する。回答/flag/有効timingを持つdraftの実取込・原本削除・再開を検証する。
- [x] comment4638649407: 資格/査定の連続操作が同じ古いrevisionで競合しないよう、保存待ちの操作制御とref guardを追加する。実応答hold/releaseで確認する。

900b78fはpush済み。data/glossary/progress CI成功、authは実行中。追加3件の修正・検証と新head CIが完了するまでDraftを維持する。

追加3件修正後: `pr63-normalization-profile-check.log` 全174 unit/1423 assertions・重複0・型/構造/教材/build成功。`pr63-normalization-profile-progress-final.log` 実29件成功（59.0秒）。ISO-Zの旧producer履歴、回答/flag/実選択時刻付きdraftの取込→照合→原本削除→再開、実profile応答hold中の全操作無効化→ACK→次資格→両資格とrevision更新→reload保持を確認した。初回27成功/2失敗は新testの入力名・fetch.ok判定の誤りで、期待する保存/再開条件を維持して修正。保存guardはvoidのguest成功とowner/generation切替を区別し、旧成功/失敗・finallyで新ownerを更新しない。read-only再レビューで具体的P0/P1/P2なし。新headのCI/review・merge・SQL004005/サイト公開は継続する。

## Codex追加レビュー（7f4ade2）

- [x] comment4638940146 / PRRT_kwDOVzQ52c652oNO: 保存同意guestの旧取得資格dva-c02/sap-c02を現行IDへ正規化する。従来loadProfileとmember明示移行の変換を共通化して維持し、現在資格のチェックと未取得推薦からの除外・reloadを実検証する。

guest旧資格の最終修正: aliasを共通helperへ分離し、guestとmember移行/照合で同じ現行IDと重複除去を使用する。同意後のretryでguest storeを再初期化し、固定revisionだけでなくprofile identityの変化にもUIを同期する。旧成功/失敗・owner/generation guardは維持。`pr63-guest-profile-sync-check.log` 全176 unit/1429 assertions・重複0・型/構造/教材/build成功、`pr63-guest-profile-sync-progress.log` 実30件成功。初回29成功/1失敗は実際の同意後UI非更新を検出し修正したもの。独立read-only最終レビューP0/P1/P2なし。7f4ade2の4CIは全成功。追加修正headのCI・merge・本番公開確認は次工程。
