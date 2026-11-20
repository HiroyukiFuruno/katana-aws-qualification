# 基礎学習のスライド化・途中チェック・合格判定

最新指示: 2026-11-20。本文は評価済み。所要時間、スライド画面遷移、途中理解度テスト、最終基準による合格を追加する。対象は既存全12単元。Issue #25を再開し、本文整備済みの証跡を保持する。

## 固定する要件と検証

- [ ] 所要時間: 単元全体/各スライド、読解+演習の目安と算出根拠。実測値/制限時間と区別。
- [ ] 1ページ=1スライド: 実ルート遷移、前/次/目次、現在位置、直接URL、ブラウザ履歴、旧URL/復習リンク互換。
- [ ] 途中チェック: 学習目標/本文節に対応し、回答→選択肢別解説→本文復習/再挑戦。最終試験の受験回と区別。
- [ ] 合格: 全スライド閲覧・途中チェック実施・最終80%以上を明示。ceil(問題数*0.8)、未回答不正解、複数選択完全一致。受験回単位で判定し過去正答の寄せ集めは禁止。
- [ ] 最終試験: 直前の途中チェックと同一の出題を避け、目標を網羅。合否/正答数/基準/復習導線/再受験を表示。
- [ ] 進捗: 未学習/学習中/受験中/要復習/合格、教材改訂・受験回・位置を保存。旧回答を新基準合格にしない。
- [ ] 保存: #23の会員DB/同意ゲスト/同意なし一時利用の境界とowner/generationを利用。保存失敗やアカウント変更で他人へ混入しない。#24の分析契約へ接続。
- [ ] 広告: 実際の遷移・既存同意と広告方針に従う。人工PVや自動広告更新なし。読解/操作を遮らない安定レイアウト。
- [ ] 全12単元・10言語・モバイル/キーボード。内容対応静的検査、採点境界単体、実サービスE2E、既存check、Draft→review→指摘修正→Ready→CI→merge→公開確認。

## 実施順序

公開済み#23 → 本改修 → #24 → #58 → #59/#60。既存の永続化編集中ソースへ重複実装しない。本人確認はClose条件としない。初期合格率80%は今回の暫定仕様で、変更時は仕様とテストを同時更新する。

## フィードバックの扱い

- [/] 所要時間がない。
- [/] 一括の長文表示をeラーニング完成と扱わない。1ページ1スライドを遷移する。
- [/] 理解度テストは最後だけに置かない。
- [/] 回答済みと合格を混同せず、基準を満たした受験回のみ合格にする。

実装済み・公開前検証中。以下の途中経過は時点ごとの記録であり、現在の状態は末尾の最新証跡に従う。公開後の証跡を追記してからCloseする。


## スマートフォンのスライド体験（最新の追加指示）

- [/] 縦長本文のページ分割ではなく、パワーポイントのようにスマホで1画面ずつ読む。章の数をスライド数と同一にせず、長い章は要点・図解・例を複数スライドへ再構成する。
- [/] 本文を小さい文字で詰め込まず、切り取り/overflow hiddenで情報を隠さない。320/390px・横向き・文字拡大時も全内容へ到達でき、アクセシビリティ上必要なスクロールは許容する。
- [/] STEP n / N、あとN-nステップ、進捗バーを表示。必須の読解・途中チェック・最終テスト各問を含む固定した学習計画から総数を導出し、初期表示から終了まで残数に一貫性を持たせる。
- [/] 画面下の前へ/次へを安定した位置に置き、スマホの安全領域、キーボードフォーカス、戻る操作、回答/解説の表示と競合しない。広告も操作を遮らない。
- [/] 再挑戦や任意復習を通常進捗の完了と混同しない。読んだ枚数だけで合格にしない。

確認済みの現状: 4本文節/単元は長い章であり4画面に固定しない。既存の最新回答集計だけでは読解・途中チェック完了・受験回単位の合格は再現できないため、#23基盤上の専用進捗/受験回契約が必要。設計時にreset/delete/所有者/教材改訂を含める。


設計上の固定境界: 学習保存未同意のゲストも通常のスライドnext/backで学習を継続できること。pathnameは遷移させるが通常クリックはSPA navigationとしてtabメモリを保持し、reload/別tab時だけ一時記録が失われることを説明する。未同意なのにsessionStorage等へ隠れて保存して継続させてはならない。全10言語の検証対象は既存のUIロケールであり、教材本文の現行言語を全翻訳する別範囲へ勝手に拡張しない。

## 実装作業（既存worktreeを再利用）

- [x] release/fundamentals-delivery（既存kaq-fundamentals checkout、基点28e29b4）で画面コンポーネントを開始。#23公開と競合しない新規learner配下とUIロケールに限定する。新規worktreeは作らない。
- [x] 同一Gitのaccount-progressには#23の19thレビュー修正があり、公開前にその正式mainを本branchへ統合して検証する。23のSQL/サイト公開順序は維持する。
- [x] root: route/provider/進捗・受験回統合と全体検証。UI担当: learnerコンポーネント/10ロケール。trusted catalog/DB草稿・モデルはprivate検証済みの準備物であり、正式実装へ取り込む際に契約を揃え直す。

現在の実測: semantic modelは12単元/読解294/途中48/最終144、単元39〜43STEP。実React草稿の最長readingは390×844で全文fit、320×568では内部scrollが必要。viewport別にSTEP総数は変えず、文字縮小/本文削除はしない。これは草稿の検査結果であり公開lesson/保存/採点の完了証跡ではない。

## 実装途中の証跡（公開完了ではない）

- src/fundamentals/state/guestInitial.ts・guestStep.ts・guestFinal.ts・guestSnapshot.ts・guestSourceCodec.ts・guestStorage.ts: 必須STEP順序、途中チェックreceipt、12問の受験回別採点、旧版/不正参照/不正時刻拒否、未同意時の端末データ非参照・非保存、同意時の明示競合解決、reset時の一時記録削除を実装。guest-flow 2件20assertions、guest-storage4件16assertions成功。画面・実サービス検査は未完。
- test-results/data/fundamentals-seed-001-010.log: 001010適用と全5SQL fixture成功、12catalog/144final/48checkpointのcanonical一致確認。正式data:integrationにも適用・fixtureを組込んで成功。
- delivery strict loader全12単元検査とindex metadata保持、LessonCatalog/STEPshellコンポーネントは作成済。main/providerへの組込・正式build・実UI/E2E・公開は未実施。

#23はPR63/main22ce5c65a7a24863305d567621bc6635c0278833と本番SQL001006/同source公開/実guest確認を完了しClose済み。本branchも正式mainへff統合済み。#25はmain UI接続・全check243unit2650assertions成功、最初の実browserはCookieモーダル操作不足で中断し、必要なもののみをUIで選ぶ検査へ修正した。改修版14件の全実browser検査が成功（test-results/progress/fundamentals-slides-second-progress.log）。会員lesson保存・outbox・guest移行・全既存45回帰と公開は未完。

## 統合後の残検証（2026-11-20）

- [x] 実guest14件34.4秒、全12単元の読解・途中4checkと10/12合格reload。
- [x] 実member2件10.5秒、16event・別owner非表示・guestコピーなし・native offline同UUID再送/reload。最初のstart失敗はSQLresumeStepIdの位置/ID混在でありfinal/result=NULLへ統一し回帰追加。
- [ ] 最新追加source: related reading選択保持、cross-tab summary/reset/BroadcastChannel、queued guest reset epoch、native backで旧member outbox回収、microsecond result順序、明示guestlesson import+server世代/receipt/time/ref照合。型付き保存/単体はあるが実検査未回収。
- [ ] auth既存基礎ゲートを削減しない: 全12の4形式/合格/catalog保持、関連説明・固定受験回、別tab/reset、10locale×2幅×2theme=40を復元。新mobile48（390/320/横向き/200%）を回収。
- [ ] 最新全check・data001010/全fixtures・全progress既存45+新規・全auth・視覚実画面確認。
- [ ] Draft PR→Codex review→指摘取得/修正reply/resolve→Ready→全CI→merge→新鮮な暗号化publicbackup→007010SQL/権限・catalog照合→公式mainのみサイト公開→source/実公開確認→#25Close。
- [ ] 次#24dashboard→#58連携→#59/#60。FB22はMeta制限外部待ち、Amazon除外。

最新実検証: mobile48件2.2分（390/320/横向き/200%文字、各12単元の全必須STEP）、import/member5件24.2秒（submitted/active raw保持→明示import→DB照合後削除、owner隔離・offline再送/native back/forward）成功。前のimport3段の不一致（wire cursor/未回答選択数/時刻等価比較）は実traceで原因特定して修正、元記録は各失敗時に保持。最新SQL001010/5fixturesはdata:integration成功。全112progress/全auth58基礎含む既存authの一括回収へ進む。依存outdated候補なし・157package audit0、lock不変。

## 最新の検証・残作業（統合版）

- [x] main22ce5c65a7a24863305d567621bc6635c0278833（#23公開済み）を統合し、既存checkout/release/fundamentals-deliveryで実装。stash0、新worktreeなし。
- [x] 全12単元、読解294・独立checkpoint48・最終144、39〜43STEP。固定plan由来のSTEP n/N・残数・進捗バー、ルート/目次/前後/ブラウザ履歴、目安時間、固定下部操作を接続。
- [x] 厳密codec、会員RPC/outbox/generation、同意guest保存・未同意tab内のみ、reset/BroadcastChannel、明示guest移行/DBreceipt照合後のみ原本削除。基礎の通常履歴をlegacy storageへ二重投影しない。
- [x] 最新 bun run check: test-results/data/fundamentals-complete-check.log。256unit/2758assertions、lint/format/i18n/重複0/150行/依存方向/内容/生成整合/build、3540public/1560private route検査成功。
- [x] 実guest14件、mobile48件、member/import5件に加え、test-results/progress/fundamentals-conflict-attempts.log の実2件16.8秒成功。同一会員2contextのPT412→保存済み選択再読込→新revision保存、6/12+別6/12を合算しない・10/12合格後の再不合格でも以前の合格receipt保持。
- [x] test-results/progress/fundamentals-e2e-types.log: 全基礎auth/progressテストを型検査。
- [x] data001010+5fixture・RLS・競合成功（test-results/data/fundamentals-release-data.log）。その後summary RPCのanonymous EXECUTEを明示revokeし、権限回帰を追加したため最新版を再検査する。
- [x] 依存直接/推移/lock確認、outdated候補なし、157package audit0。test-results/data/fundamentals-dependencies-*.log。
- [ ] 全progress114予定（既存45+全新規）、全auth（基礎58含む）、最後のSQL権限追加込みdata:integrationを回収。検査失敗は診断して修正し、件数やgateを下げない。
- [ ] Draft PR→@codex review/自己レビュー→全指摘取得・修正reply/resolve→P0/P1ゼロ→Ready→全CI→merge。
- [ ] 新鮮な暗号化public backup→本番007010適用→12catalog/hash/RPC権限照合→公式mainのみVercel公開→customdomain/source/実公開確認→#25Close。

読取レビュー: summary RPCのrevoke漏れは採用して修正済み。legacy history/profileと基礎専用進捗の移行案内は別sourceを扱い、同じ原本の二重取込ではない。旧履歴移行導線を削らず両者を保持する。

既知の失敗と修正: 初回guest検査のCookieモーダル操作、SQL final/result resumeStepIdの誤値、submitted importのUIcursor混入、未回答/部分選択拒否、同時刻表現の文字列比較、catalog遷移完了前の原本比較をそれぞれ原因に沿って修正。保存元は各失敗時に保持され、移行成功時のみ削除した。保存競合時の明示再読込は画面を再初期化し、別タブの更新で入力中の選択を自動破棄しない。

最新回収: main672904aへff統合後のcheckは259unit/2775assertions成功（test-results/data/fundamentals-upstream-check.log）。authは初回162pass/2fail（catalog名と本文titleの語順差を検査が同一視したもの）をstable単元URLによる特定へ修正し、全164件3.9分成功（test-results/auth/fundamentals-fixed-auth.log）。progress全114件4.7分成功（fundamentals-complete-progress.log）、data最新SQL匿名権限回帰込み全fixture成功（fundamentals-complete-data.log）。上流追加AIB-C01実回帰1件を別途回収し、既存114件の結果を保持する。公開前のDraft review/CI/merge/本番反映は未完。

## PR66 指摘対応

- [x] P2 completedmanifestで同一row/hashの移行確認・削除再試行を許可（別payloadは拒否）。
- [x] P1 trusted catalogから連続した完了prefix/位置/receipt/final前提をDBでも検証。CP再挑戦の複数receiptは保持する。
- [x] P2 単元Aのoutbox競合でB/catalogを止めない。unit/version別flush、confirmed summaryと保存待ち案内。test-results/progress/pr66-outbox-scope-progress.log 実7件33.4秒成功、元command保持/別単元保存/明示解決を確認。
- [x] test-results/data/pr66-review-check.log: 260unit/2781assertions・全quality/build成功。全基礎E2E型検査も成功。
- [ ] 最新SQL実検証・統合focused回帰→commit/push→3threadreply/resolve→再review/最新head全CI→Ready/merge/publication。

CI初回head065de59: data/progress/glossary成功、authは163pass/1fail（全許可再選択後の解析許可再適用）。mainのanalytics初期化依存をcookie consentの値だけでなく安定snapshotへ変更。同意UIが反映済みであることを待ってからoptoutし、実際のga-disable false→true→falseも検証する強化版cookies5件が成功（test-results/auth/pr66-consent-settled-regression.log）。test-results/data/pr66-review-final-check.logの全checkも成功。初回CI失敗を無視してmergeせず、修正後headの全CIを改めて回収する。

SQL最終検証: test-results/data/pr66-import-review-data.log の実001010/全fixture成功。完了済みaccepted row/hashの冪等再試行、不完全進捗/欠落receipt/範囲外/不連続/再開不整合/UUID等価重複/必須field・questionRef欠落を拒否し、CP再挑戦の複数receipt+active final正例を維持した。初回追加validatorの括弧構文エラーを修正し再実行成功。rootは最終SQLに対する実guest移行2件を追加回収する。

再レビュー head912cf34: 追加P2（別タブが破棄/ACK済みcommandを旧pending全体から復活させる）を採用。outbox永続化を新規追加/明示削除とshared storage再照合へ変更し、durable履歴と未永続のmemoryを区別する。agent cicd_questions がoutbox/persistenceとunit回帰を担当中。rootはsharedBrowserContextの2tab+外部更新で、Aの破棄後も古いcacheを持つtabがBを保存してAを復活させない実browser回帰（test/progress/fundamentals-shared-outbox.pw.ts）を作成済み、未実行。freeze後にglobalcheck→対象実progress→commit/push→thread4643263579返信/resolve→再レビュー/最新CIを回収。既存3threadは修正912cf34で返信/resolve済み。

共有outbox検収: rootのnative初回は5/6成功、1件は保存済みreloadが現在のreading STEPを維持する実仕様をSTEP2移動と誤って期待したharnessを修正。storage書込失敗中のRPC禁止と同ID再試行、共有側の新世代検知時に直前commandもinvalidatedにする回帰を追加。後者はREDを確認し、sync前の検証/current UUID無効化で修正。outbox10unit43assertions成功。test-results/data/pr66-shared-outbox-final-check.logの全check成功。最終sourceに対する実6件を再実行中（pr66-shared-outbox-final-progress.log）。

共有outbox最終source: test-results/data/pr66-shared-outbox-final-check.log は264unit/2797assertions・全quality/build成功。test-results/progress/pr66-shared-outbox-final-progress.log は実6件31.1秒成功、同一originのshared context2tabで古いcacheを保持したままA破棄→B保存→A再開しても破棄済みcommandが復活しないことを確認。head912cf34の全4CIも成功（auth44747769555/progress44747769725/data44747769835/glossary44747769977）。この追加修正をcommit/pushし、4th threadへ返信/resolveして最新headの再レビュー/CIを回収する。
