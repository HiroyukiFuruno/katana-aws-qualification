# Google SSO（#19）

## 契約
既存のSupabase adapter/PKCE callback/session/identity連携を再利用し、registryにGoogleを追加する。
scopeは`openid profile email`だけ。Gmail/Driveやオフラインアクセスは要求しない。
初回SSOで登録し、Google専用のパスワード/メール登録フォームは設けない。
メール属性が返らない場合もUIはメール表示を前提とせず、providerエラーは共通境界で扱う。

## 設定
1. KAQ専用Google Cloudプロジェクトで外部向けOAuthアプリを作る。課金/無料トライアルは不要。
2. Web clientのJavaScript originを`https://kaq.katana-projects.org`、redirect URIを`https://vawysutvqmtxthbtflsu.supabase.co/auth/v1/callback`へ限定する。
3. ブランド/プライバシー説明と連絡先を設定し、一般利用する場合はテストユーザー限定でなく公開状態にする。検証要否はGoogle Consoleで確認する。
4. Client ID/SecretはKeychain `KAQ Google OAuth Client ID` / `KAQ Google OAuth Client Secret`（account `kaq-production`）とSupabase Google providerへ保存する。ブラウザ配布はしない。
5. 本番の`/auth/v1/settings`でGoogle有効・非SSO無効、認可redirectのclient ID/callback/scope/stateを照合してから、Vercel Productionで`VITE_AUTH_GOOGLE_ENABLED=true`にする。
6. 検証/previewは別の専用client・Supabaseへ分離する。未設定の環境はGoogleボタンを表示しない。

## 自動検証
- registryのGoogle単独/GitHub併用/無効状態と、最小scopeを単体で検査。
- 実GoTrueのGoogle認可開始と、実OIDCで認証した利用者のGoogle連携開始を検査。
- 成功/再ログイン/取消し/連携の共通callbackと全10言語は既存の実Auth/OIDC検証を維持する。Google本人のMFA/CAPTCHAはCIに持ち込まない。

## 登録作業の記録
Google Cloud専用プロジェクト`learned-battery-515218-q6`でclient作成、外部/公開状態、Keychain保存、無効codeのtoken endpoint照合まで実施。
Supabase管理の本人再ログイン後にproviderを有効化し、本番設定・公開証跡をIssueへ追記する。未有効化を利用可能とは報告しない。

## 一次資料
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://developers.google.com/identity/protocols/oauth2/web-server
