# #18 Supabase・GitHub SSO実装計画

## 合意と対象
- #17/#18の要件を一次情報とする。ユーザーの「worktreeを活用して18から、トランクベース」の指示により実装を開始する。
- 専用worktree `kaq-issue-18`、短命ブランチ `release/account-github` を最新origin/mainから作成。教材拡充セッションの作業場所は変更しない。
- 今回はGitHubと共通認証基盤。Google/Microsoft/Amazon/Facebookの実有効化、学習DB移行と分析は#19〜#24へ分離する。

## 設計
- Supabase SDKは認証adapterに集約。provider registry・認証契約・session状態管理・React UIを分離する。後続providerはregistryと固有設定を追加する。
- 認証はPKCE。明示的なcallback処理後にURLからcodeを消去。固定の言語付きdashboardへ移動し、任意return URLは扱わない。
- Supabase user IDを主キーとする。初回SSOは許可し、メール/電話/匿名の登録・ログインは無効化する。最後のidentityの解除は禁止。
- `login/`, `auth/callback/`, `dashboard/` は公開教材のsitemapから分離し、個人情報を持たないnoindexシェルだけを生成する。
- session解決前に個人情報を描画しない。logout/別ユーザーへの切替時は旧状態を破棄する。Supabaseが管理する検証済みidentity連携以外にメール一致で独自統合しない。
- 設定がなければSSOボタンを有効にしない。秘密情報はブラウザへ配布しない。認証callbackにはGA4を読み込まない。
- アカウント削除は認証済み本人を検証するサーバー境界で行う。#23で関連DB削除を追加できる契約とする。

## 手順・DoD
- [x] 契約・callback・registry・非公開routeの回帰テストでREDを確認。
- [x] Supabase adapter、session状態管理、GitHubログイン、callback、dashboard枠、連携/解除・logoutを実装。
- [x] 非SSO入口を無効化する設定と検証、アカウント削除境界、説明/翻訳/設定手順を実装。
- [x] 実Supabase Auth/Postgresと標準OIDCテストIdPのDocker環境で成功/拒否/期限切れ/再利用/連携/session更新を検証する。Mockは禁止。
- [x] GitHubの認証開始redirect/scope/callbackを検査。本人のアプリ登録・同意は独立フォローアップに記録し、未有効化を一般公開済みと扱わない。
- [x] `bun run check`、型/アーキテクチャ境界、秘密情報非混入、保護routeと既存学習の回帰を検証する。
- [ ] 自己レビュー、Draft PR、レビュー回収・指摘修正/resolve、Ready、required checks、main統合、公開物を確認する。

## 検証と記録
- [/] 可逆的な登録・設定変更は追加承認なしで進める。確認は不可逆・破壊的な操作と本人のみ実行できる認証に限る。一任済みのアプリ登録やsecret保存ごとに再承認を求めない（`reversible no reapproval`）。
- ユーザー指示「mock活用してね」を反映する。単体テストはBunのmock/spyOnでSDKの失敗・遅延・session競合・identity制約を再現する。反対例は全ケースを外部ログインへ依存させること。実Auth/OIDCの結合検査は必要な正常系と設定検証へ絞る。
- 認証情報の準備はユーザーから一任済み。Supabase登録・無料プロジェクト・GitHubOAuth設定を進め、秘密はmacOSキーチェーンへ保存し、コード・Issue・ログへ出さない。
- 既存の150行制限・重複検査・依存方向・教材検査を維持する。
- テストは再現可能なfixtureと期待値を使い、実サービスのレスポンスと表示を確認する。本人のパスワード/MFAをCIへ保存しない。
- 検証ログは `test-results/auth/`、実装/設定/本人担当の残作業は本計画とPRへ記録する。

## 実施結果（2026-11-20）
- RED確認後に実装。`bun run check` は全品質ゲート、単体33件、型検査、production build、非公開routeシェル30件を通過。
- `bun run auth:integration` は実Auth/Postgres/Keycloakで21件成功、失敗0。ログは `test-results/auth/check.log` と `test-results/auth/results.json`。
- 独立した認証・セキュリティ再レビューで未対応P0/P1なし。GitHub上のDraftレビューと公開確認は継続中。
- Draft PR #26の最新コードレビュー（d62a57e）は指摘0、未解決thread 0。Linux CI run 44581323835も単体33件・実認証21件を含め成功。初回CIで判明したテストTLS鍵のUID差は、生成fixtureだけの読み取り権限修正で解消した。
- Supabase Free専用プロジェクトを東京に作成し、SSO限定設定と10言語callbackを設定済み。GitHubアプリ登録の確定と本番接続は準備中。
