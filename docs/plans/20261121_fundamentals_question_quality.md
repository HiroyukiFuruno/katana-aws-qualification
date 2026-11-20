# #68 基礎学習の設問品質と教材版の保持

一次情報: 画像7420・本人の「これ意味不明じゃない？」。#67の操作/広告修正を先行公開し、本Issueの教材修正、その後#24へ戻る。#24はrelease/dashboardの3b16a8b・ccbe430に保持しており、破棄/完了扱いにしない。

## 到達条件

- [ ] 全12単元の最終144問・途中48問をID/極性/選択数/正答とともに照合する。機械的なキー一致は意味の正しさの証明としない。
- [ ] 曖昧な前提、抽象論だけで状況を比較させる設問、本文にない正答条件を修正する。修正した各問は前提→選択肢→正答→解説→本文/一次資料の対応を残す。
- [ ] 公開済みmigration/教材版を改変しない。過去の回答・最終下書き・未同期コマンドが旧版の設問で整合し、新版の合格へ自動流用されないことを検証する。
- [ ] 品質ゲート、実Auth/DBの新旧版/取込/owner分離、実スライドの表示/採点、Draftレビュー手順、DB/サイトの公開証跡でCloseする。本人実機確認は独立フォローアップ。

## 監査の扱い

`docs/reviews/20261121_fundamentals_questions_first6.md` と `...last6.md` に各96問の一覧がある。担当からの所見は候補であり、採否は元のJSON・本文・一次資料をmainが照合する。

最初の監査には「誤りを選ぶ」を「正しい方針を選ぶ」と取り違え、正答B/DをB/Eと記す誤認があった。原文照合で修正を求め、`fund-services-108`とcomposition checkpointの誤指摘を撤回した。「複数要件を扱う設問で2つ選ぶ」ことだけを欠陥とは扱わない。

## 主な採用方針・要確認

- [ ] `fund-cloud-111`: AZ-aに3台のA案、AZ-a/AZ-b各1台のB案とAZ-a停止を明示する。A案の全停止、B案で残る1台と必要な処理能力確認を具体的に問う。架空の台数優位や、未記載の処理性能を断定させない。本文の可用性/性能の区別と接続する。
- [ ] testing checkpoint test-design: 時計規則だけでなく、入力時刻と適用税率/期待値を固定した例にして、実行時刻依存の曖昧さをなくす。
- [ ] testing checkpoint quality-gates: どの型検査が必須かを明記する。
- [ ] release checkpoint observation-abort: baselineとの差と中止閾値を混同しない。中止閾値を超えた観測値を明示して停止判断を問う。
- [ ] observability checkpoint objectives: SLOの対象/成功条件/分母/観測期間と、通知運用の要件を区別する。SLO定義だけで全alertを必須としない。
- [ ] NAT ping、TLS診断の確認対象、他のP2候補は原文と一次資料を確認してから採否を決める。「最初に」という問題文にない条件を監査側から付け足さない。

AWSのAZ分離・同一AZの障害範囲は公式資料をライブ照合済み:
https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html

## 教材改版の保存境界（実装前に固定）

- 公開済み`202611200010_fundamentals_catalog.sql`を現行教材から再生成して書き換えることは禁止。新しい教材catalogは追加migrationで公開する。
- 旧版のdelivery index・manifest・unit assetを読み取り可能な履歴として保持する。現行indexの12単元と旧版の参照を区別し、contentVersion指定の旧コマンドを現行設問へ読み替えない。
- asset resolverは旧版も原文のhash/plan/question参照で検証する。会員outboxは原owner/gen/commandを保持して旧版のRPCへ再送できる。guest旧版の元記録を削除せず、明示取込と分析にも必要な旧版metadataを利用できるようにする。
- 現在の単元進捗は現行版だけを示す。過去の最終受験/合否/分析履歴は旧contentVersionとともに保持する。教材改版をユーザーの学習データresetとして扱わない。
- seed検査は旧migrationの固定入力と、追加migrationの現行入力を別々に検証する。既適用statement/name/hashの照合を維持する。
- #24の未公開migration番号が新しい公開順より過去にならないよう、#68公開後に未公開分だけ番号・fixtures・私用公開guardを更新する。既適用の番号は変更しない。

## 検証台帳

- [ ] 修正一覧と原文/根拠を確定し、極性/必要選択数/正答の整合を再確認する。
- [ ] 教材生成・seedの新旧双方の不一致を検出する検査。
- [ ] 旧版で進行中の会員finalとdurable outbox、新版の別進捗、過去の合格/回答履歴を実境界で検証する。
- [ ] guest旧版sourceの再開/取込/分析と、会員化後の重複排除・owner分離を検証する。
- [ ] Draft→自己レビュー/外部レビュー→指摘修正/reply/resolve→Ready/CI→追加DB migration→サイト→公開照合→Issue Close。

この文書は設計・未完了台帳であり、実装/公開済みの証拠ではない。

## 初期実装の証跡（未公開）

- `release/fundamentals-content`で#67の公開候補とは別に保持。原15assetは`history/2026-11-20`へコピーし、連結SHA256 `52502b0c005e796da4a496d7c6cb890b06d14d9f77d8b3352fc26f6b618003ea`と旧010の全文一致を単体で固定した。
- 比較問題1問・途中4問と対応本文、NATの本文を修正。現行12単元のうち5単元が新しいcontentVersionとなり、追加`202611210001_fundamentals_catalog_revision.sql`には新しい5版だけを挿入する。旧010は未変更。
- checkpointの生成器がrevisionを常に1へ戻していたため、正の明示revisionを保持するよう修正し、revision=3の保持とrevision=0拒否を回帰テストへ固定した。
- `issue68-check.log`: 277単体と全check/build成功。`issue68-edition-revisions.log`: 実Auth/DB/browser3件成功（6.6s）、旧版の最終下書き/合格の明示取込・再取込重複排除・別owner不可視・新版へ合格や読了を流用しないこと、旧版outboxの原版解決/同じreceipt再送を検証した。9件/90assertionsの広告部品単体も入口で成功。
- 現在のUI進捗は現行版だけ。旧版の原記録は削除せず取込可能。旧版の再開導線・未同期の回復表示、全192問監査文書の最終照合、全体回帰・レビュー・DB/サイト公開は未完了。
