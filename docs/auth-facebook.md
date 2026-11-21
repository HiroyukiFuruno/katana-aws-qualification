# Facebook SSO（#22）

## 契約

既存のSupabase adapter、PKCE callback、session、identity連携を再利用する。registryの表示名とSupabase backendはともに`facebook`である。Facebook専用の登録フォーム、パスワード、callbackは作らない。

要求するscopeは`email public_profile`だけで、Graph APIの追加権限、投稿、友人、広告、オフラインアクセスは要求しない。emailが返らない場合はメール表示を前提とせず、既存の共通callback分類で安全に案内する。OAuthの取消しもraw errorやFacebookの説明文を表示せず、既存の共通案内に分類する。

## Meta と Supabase の設定

1. Meta for DevelopersでKAQ専用アプリを作り、Facebook Loginを追加する。Use CasesのAuthentication and Account Creationで`public_profile`と`email`をテスト可能にする。
2. Facebook Login SettingsのValid OAuth Redirect URIsには、Supabase Dashboardが表示する`https://<project-ref>.supabase.co/auth/v1/callback`だけを正確に登録する。
3. App IDとApp SecretはSupabase Facebook providerへ保存する。secretはKeychain等の秘密保管だけへ保存し、ソース、ログ、Issue、`VITE_*`へ入れない。
4. Supabase providerとVercel Productionの両方が確認できるまで`VITE_AUTH_FACEBOOK_ENABLED=false`を維持する。未設定環境ではボタンを表示しない。
5. MetaアプリがDevelopment modeの間はroleを持つテスターだけが認証できる。一般公開の前に必要なApp Review、プライバシーポリシー、アプリアイコンなどのMeta要件を確認する。

## アカウント削除案内

SSO registryに加え、削除UI・本人確認するEdge Function・案内ページを提供する。本番Facebook flagはMetaの公開設定とSupabaseへのcredential反映を確認するまでfalseに保つ。退会の契約と配備手順は[auth-deletion.md](auth-deletion.md)に記載する。

公開する削除案内URLは`https://kaq.katana-projects.org/privacy/#account-deletion`である。外部providerで連携を解除してもKAQアカウントは消えない。利用者はログイン後に「アカウント設定」から「アカウントを削除」を選び、取り消せない操作を明示確認する。

ログイン済み利用者のKAQクラウド記録は、本人確認済みのアカウント削除に伴う対象として削除する。ゲストの端末側履歴やCookieはクラウドアカウントとは別管理で、アカウント削除によって自動消去しない。端末側の削除・Cookie設定手順は既存の[auth-deletion.md](auth-deletion.md)およびプライバシー案内を参照する。Metaのsigned-request deletion callbackや不正通知を受けるURLは設定しない。

## 自動検証

- registry、flag無効時の非表示、backend、最小scopeを単体で検査する。
- 実GoTrueでFacebook認可開始、PKCE callback、認証済み利用者のFacebook identity連携開始を検査する。
- email欠落とOAuth取消しは共通の安全なcallback分類を維持し、全10言語の公開削除案内を検査する。
- 実Facebook本人ログインはMetaアプリ有効化後の公開証跡で確認する。未有効化を利用可能とは報告しない。

## 一次資料

- https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook
- https://developers.facebook.com/docs/facebook-login/


## 外部設定の実施記録（2026-11-20）

KAQ専用Metaアプリの作成、email/public_profile、ドメイン、privacy/deletion URL、教育カテゴリ、公開サイトと同じアイコンの保存を確認した。Supabase callbackはMetaのURI検証に合格し、App ID/SecretをMacキーチェーンとSupabaseへ保存済み。Facebook providerと本番ボタンは無効のままにする。

実際の「公開」画面はビジネス認証を必須とし、公開ボタンは無効。本人承認済みの運営名・管理者名・連絡メールでポートフォリオ作成を試みたが、Metaが「広告の利用が制限されています」と表示し、新規ビジネスポートフォリオの作成を拒否した。アプリ自体の「必要なアクション」は0件であり、これを一般公開済みの意味には扱わない。

公式のアカウント品質/Business Support Homeも確認したが、現画面に制限の再審査を送信するボタンは提示されていない。運営者によるMeta側の制限確認・解除後に、ビジネス認証、App Review、本番有効化、実ログインを再開する。別アカウントや別ポートフォリオを使った制限回避は行わない。#22は未完としてOpenを維持する。
