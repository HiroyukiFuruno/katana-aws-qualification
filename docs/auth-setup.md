# アカウント認証の設定と運用

## 構成
KAQはSSOだけで登録・ログインする。#18はGitHubを実装し、後続4providerは個別Issueで追加する。
未ログインでも既存の学習機能を利用できる。学習履歴はまだ端末内保存であり、DB移行は#23、傾向分析は#24。

## 本番設定
1. KAQ専用SupabaseプロジェクトをFreeで用意する。既存の他アプリの設定を流用しない。
2. AuthでEmail/Phone/Anonymousを無効にし、OAuthでの初回ユーザー作成を許可する。
   全ユーザーのsignupを一律無効にすると初回SSOも壊れるため区別する。
3. Manual Linkingとrefresh token rotationを有効にする。
4. Site URLを `https://kaq.katana-projects.org`、redirect許可先を各言語の `auth/callback/` の完全URLとする。
   ワイルドカードのpreview URLや任意のreturn URLは許可しない。previewは検証用プロジェクトへ分離する。
5. GitHub OAuthアプリを作成し、callbackはSupabaseが表示する `https://<ref>.supabase.co/auth/v1/callback` へ設定する。
   OAuth Client ID/SecretはSupabaseのGitHub provider設定へ保存する。
6. Vercelに `.env.example` の公開URL・publishable keyを設定する。設定を検査した後にだけ `VITE_AUTH_GITHUB_ENABLED=true` にする。
7. 再ビルド・公開後に、ログイン開始、callback、SSO以外の入口拒否を確認する。

ローカルの宣言は `supabase/config.toml` に置く。本番に自動適用されたことを意味しないため、管理API/設定画面でも照合する。
実際に有効なproviderと、登録・設定待ちはPR/Issueに分けて報告する。

## 秘密情報
- OAuth secret・Supabase管理token・service-role keyはmacOSキーチェーンへ保存する。
- `.env` に使うのはブラウザ公開可能なURL/publishable keyのみ。OAuth secretや管理keyをVITE_*へ入れない。
- キーチェーンの値を標準出力・ログ・Issueへ印字しない。必要なAPI呼出しのメモリ内だけで使用する。
- GitHubのアカウントID・未検証メールの一致だけで別ユーザーのidentityを結び付けない。

## アカウント削除の境界
外部サービス側で認可を取り消しても、Supabaseユーザーは削除されない。
現段階は運営者が削除依頼の本人性とuser IDを確認し、Supabase管理APIで対象Authユーザーを削除する。
メール属性だけを根拠に削除せず、秘密鍵をブラウザへ渡さない。APIの削除結果と再取得で完了を確認する。
#23では、認証済み本人に対するサーバー側の削除境界から関連DB・未同期データの削除まで拡張し、
他ユーザーの削除やローカル再送による復活を防ぐ。削除済みユーザーはオンライン検証に失敗し、保護画面を表示できない。

## 検証
- `bun run check`: 既存の全品質検査、認証契約/adapterのmock単体テストを含む。
- `bunx playwright install chromium` の後、`bun run auth:integration`: Dockerで実Auth/Postgres/OIDCを起動して結合検証する。
- 固定のテスト用秘密・アカウントは `test/auth/` 内だけで使う。本番には適用しない。
- 結合検証はlocalhostの5173/54331/54440/54441を使用し、専用composeプロジェクトを終了時に停止・回収する。OIDCのTLSは生成したテスト証明書だけをAuth/Chromiumで信頼し、証明書検証を一律無効にしない。
- 検証結果は `test-results/auth/` に保存する。ここにはテスト用セッションのtraceが含まれるため一般公開しない。
