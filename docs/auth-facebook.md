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

## アカウント削除案内（次の差分で公開）

この差分はSSO registryと認可開始・連携の契約を先行して公開する。削除UI・Edge Function・案内ページは次の小さな差分として公開し、その確認まで本番Facebook flagをfalseに保つ。

公開する削除案内URLは`https://kaq.katana-projects.org/privacy/#account-deletion`である。外部providerで連携を解除してもKAQアカウントは消えない。利用者はログイン後にダッシュボードの「アカウントを削除」で、取り消せない操作を明示確認してから本人のアカウントを削除する。

現時点の学習履歴はゲストとしてブラウザに保存され、アカウント削除で自動削除しない。クラウド同期データとのcascade削除は#23で扱う。Metaのsigned-request deletion callbackや不正通知を受けるURLは設定しない。

## 自動検証

- registry、flag無効時の非表示、backend、最小scopeを単体で検査する。
- 実GoTrueでFacebook認可開始、PKCE callback、認証済み利用者のFacebook identity連携開始を検査する。
- email欠落とOAuth取消しは共通の安全なcallback分類を維持し、全10言語の公開削除案内を検査する。
- 実Facebook本人ログインはMetaアプリ有効化後の公開証跡で確認する。未有効化を利用可能とは報告しない。

## 一次資料

- https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook
- https://developers.facebook.com/docs/facebook-login/
