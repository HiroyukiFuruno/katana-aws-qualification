# Microsoft SSO（#20）

## 契約

既存のSupabase adapter、PKCE callback、session、identity連携を再利用する。registryの表示名はMicrosoft、Supabase backendは`azure`である。Microsoft専用の登録フォーム、パスワード、callbackは作らない。

scopeは`openid profile email`だけで、Microsoft Graph、メールボックス、OneDrive、`offline_access`は要求しない。Supabase Authが返すidentityのissuerとsubjectを使用し、メールアドレスやUPNの一致だけで既存アカウントを統合しない。

## Entra app と Supabase の設定

1. Entra IDでWebアプリを登録し、Supported account typesは「任意の組織ディレクトリ内のアカウントと個人Microsoftアカウント」を選ぶ。
2. Redirect URIは`https://<project-ref>.supabase.co/auth/v1/callback`だけを登録する。ローカルで実Microsoft認可を確認する場合、Azureは`127.0.0.1`をredirect hostnameとして許可しないため`localhost`を使う。
3. Supabase Azure providerのTenant URLは`https://login.microsoftonline.com/common`に固定し、client IDとsecretを保存する。client secretはKeychain等の秘密保管だけへ保存し、ソース、ログ、Issueには出さない。
4. secretの有効期限を登録時に記録し、期限前に新secretを作成、Supabaseへ差し替え、実認可を確認してから旧secretを失効させる。期限切れを待っての更新はしない。
5. Azureのoptional claimとして`xms_edov`と`email`をid tokenへ追加し、未検証メールを安全に判定できるようにする。
6. Supabase設定とVercel Productionがともに完了するまで`VITE_AUTH_MICROSOFT_ENABLED=false`を維持し、未設定環境ではボタンを表示しない。

## 組織の同意と安全な失敗表示

- `AADSTS900941`（管理者承認が必要）と`AADSTS65004`（同意が拒否された）は、組織の管理者へ確認する案内を表示する。
- それ以外の`access_denied`は通常の取消しとして扱う。raw error、説明文、メールアドレス、tenant IDは表示しない。
- 他組織のtenant設定や同意をKAQ側で代行しない。本人のMFA/CAPTCHAも自動化しない。

## 自動検証

- registry、flag無効時の非表示、backend、最小scopeを単体で検査する。
- 実GoTrueで`common` tenantへのMicrosoft認可開始、PKCE callback、認証済みKeycloak利用者のMicrosoft identity連携開始を検査する。
- 実Microsoft本人ログインは外部アプリ有効化後の公開証跡で確認する。未有効化を利用可能とは報告しない。

## 一次資料

- https://supabase.com/docs/guides/auth/social-sign-in/auth-azure
- https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes
- https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/troubleshoot-consent-issues
