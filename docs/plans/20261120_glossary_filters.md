# 用語集の拡充と分類・フィルター

## 目的・対象

既存57語を拡充し、AWS用語を分野と学習テーマから探せるようにする。
対象は用語データ、用語集画面、専用スタイル、翻訳の追加キー、回帰検証。
実装時はrelease/aip-c01-mock上で作業した。公開時は既存差分を保持し、最新mainのクリーンなcloneにrelease/glossary-filtersを作成して用語集の差分のみを取り込んだ。新規git worktreeは作成しない。
新規worktreeと他リポジトリ編集は行わない。2026-11-20の追加指示で、依存調査・Draft PR・レビュー・CI・マージ・本番公開までを対象に追加する。
分離可能な調査はあるが、指定されたsubagentモデルが現環境では利用できないため本担当で実施する。

## 仕様・完了条件

- [x] AWS公式資料を確認し、サービスとAI基礎を含む101語以上へ拡充する。
- [x] 全用語にカテゴリ1件とタグ1件以上を明示的に付ける。
- [x] カテゴリ1件と複数タグで絞り込み、検索とはAND、タグ同士もANDとする。
- [x] タグの一致条件を画面に説明し、件数、0件、全条件解除を用意する。
- [x] 用語ごとのカテゴリ・タグを表示し、そこからも絞り込める。
- [x] アルファベット順・略語検索・日本語検索・完全一致優先を維持する。
- [x] 関連用語リンク先が条件で非表示なら条件を解除して移動する。
- [x] 10言語のUI文言を揃え、用語説明の日本語表示を明示する。
- [x] データ整合性と検索の単体テスト、実ブラウザーの操作・狭幅回帰を通す。
- [x] 既存checkを実行し、結果と自己レビューを記録する。

## 手順・検証

カテゴリは主な所属分野を1件、タグはその用語の中心となる学習論点を複数付与する。
説明文に関連単語が現れるだけでは付与しない。例えばSSE-KMSはストレージ＋暗号化・データ保護、
Lambdaはコンピューティング＋サーバーレス・イベント駆動とする。
タグとカテゴリのIDはJSONで明示管理し、表示名は既存の言語別JSON、並び替えと検索はロジック側で扱う。

1. 回帰テストを先に作成して失敗を確認する。
2. 用語分類・検索ロジック、データ、UIを実装する。
3. `bun test scripts/glossary.test.ts`、専用Playwright設定でのE2E、`bun run check`。
4. 差分と最新指示を照合し、この文書に結果を追記する。

## 出典

2026-11-20確認。追加語の出典URLはデータにも保持する。

- https://docs.aws.amazon.com/whitepapers/latest/aws-overview/compute-services.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-overview/storage-services.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-overview/database.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-overview/security-services.html
- https://docs.aws.amazon.com/whitepapers/latest/aws-overview/application-integration.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html

## ユーザー指摘への対応

- [/] 分類UIだけではなく用語そのものを拡充する：既存57語を保持し、44語追加して101語にした。
- [/] 用語・分類はJSONで管理し、並び替えはロジック側で実行する。
- [/] タグの選定理由を、中心となる学習論点という基準で明文化した。

## 検証結果・自己レビュー

- RED：追加前の単体テストでfilterGlossary未実装による失敗を確認した。
- GREEN：全46単体テスト、教材32バンク、翻訳297キー、重複・依存検査、型チェック、ビルドが成功。
- E2E：カテゴリ＋複数タグ＋検索、0件と解除、関連用語遷移、タグの再解除、
  キーボード操作、全10言語・320pxでのはみ出しを5件で検証して成功。
- 既存の検証成果物に含まれるコピー設定がルートのBiome探索を妨げるため、
  管理ファイルと必要な未追跡ソースのみを複製した検証用コピーで`bun run check`を実行し成功。
  設定や品質条件は変更していない。コピー元のSHA-256一覧を保存。
- 証跡：`test-results/glossary/verification.json`、`check.log`、`e2e.log`、`results.json`。
- 利用者観点：分野と学習論点を組み合わせて探せ、説明の関連語から別分野へ移動できる。
- 自己否定・反証：完全一致検索がカテゴリ条件を無視しないこと、複数タグがANDであること、
  非表示リンク先への遷移時は検索・カテゴリ・タグを全解除することを確認した。
- 新規の公開・push・commitは実施していない。既存の他作業差分は保持。

## 公開までの追加DoD（2026-11-20ユーザー指示）

- [x] 最新mainを基準とするクリーンなチェックアウトに今回の差分だけを取り込む。
- [x] 直接・推移依存とlockfileを確認し、最新互換版を評価する。
- [x] 全checkと用語集E2Eを公開対象のソースで実行する。
- [x] Draft PRを作成し、@codex reviewと3観点の自己レビューを実施する。
- [x] レビュー結果を回収し、指摘へ対応・reply/resolveしてP0/P1が0件であることを確認する。
- [x] Ready化後にrequired checksを確認し、通常マージする。
- [x] 本番deploymentのコミットと公開URLで101語・分類・フィルター動作を確認する。
- [x] branch-hygieneで今回作業のブランチ・使用中worktree・stashを確認する。

## 公開対象の追加検査

- 直接・推移依存とlockfileを`bun outdated`および`bun update --latest --lockfile-only --no-cache`で確認。
- 直接依存の変更は不要。推移依存source-map-jsのみ1.2.2から1.2.4へ更新。
- `.github/workflows/glossary.yml`を追加し、全checkと用語集E2Eを継続検証する。

- 公開対象（最新main 4c4b7eb基準）の検証：全70単体テスト・用語集E2E5件・全check成功。
  前回46件との差はmain側の基礎学習等の追加であり、検査の除外はない。
- 自己レビューでE2Eレポートの相対パスがtest配下へ出力される問題を修正。
  出力先をプロジェクト直下のtest-resultsへ固定し、再実行後の全checkとE2Eで確認した。

## レビュー指摘対応

- [/] P2：Control TowerのGuardrailを管理・ガバナンスへ分類し直し、Bedrock Guardrailsを別項目として追加。
  Bedrockの関連リンクも専用項目へ向ける。追加後は既存57語＋44語で101語。
- 回帰テスト「Control TowerのGuardrailとBedrock Guardrailsを別の概念として分類する」で修正前の失敗を確認。
- 両方のカテゴリ・タグによる検索と、BedrockからAI向けガードレールへの関連リンクをE2Eに追加。

## 公開完了の証跡

- PR：https://github.com/HiroyukiFuruno/katana-aws-qualification/pull/52 （MERGED）
- レビュー修正：95fd06c、P2の1件へ返信・resolve。最新HEADのCodex再レビューはcompleted、追加指摘なし。
- GitHub Actions：Glossary 44628876336、Auth integration 44628876298、両方success。
- 本番コミット：e2bab8ca5db61fbd32c5ac1be0862c2378928c3f。
- 本番deployment：dpl_82JYu7AuQvbVrVV4qSr5LPQ35hqs、READY、production。
- 公開URL：https://kaq.katana-projects.org/ja/glossary/
- 本番ビルドの全checkは73単体テスト・0失敗を含め成功。PRの71件との差は、並行してmainへ入ったMLA-C01の2件。
- 本番URLのE2Eは6件すべて成功。101語、カテゴリ・複数タグ・検索・解除、関連リンク、全10言語・320px、キーボード、Guardrailの概念分離を確認。
- 詳細：test-results/glossary/production-deployment-evidence.json、production-build.log、production-results.json、final-review-summary.json。
- 整理：公開用cloneのmainはcleanでorigin/mainと一致。今回作成したローカルrelease/glossary-filtersを削除。
  リモートブランチは保持。既存3worktreeは他作業の差分があるため保持し、新規worktreeは未作成。stashは0件。
