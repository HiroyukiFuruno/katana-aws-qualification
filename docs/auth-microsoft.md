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

- Microsoftを有効にしたログイン画面には、職場・学校アカウントで組織管理者の承認が必要になる場合があることを条件付きで案内する。個人アカウントや失敗結果を組織の拒否と断定しない。
- callbackはOAuthの`error`とSupabaseの既存`error_code`だけで安全な取消し・期限切れ等を分類する。Microsoftの`error_description`や`AADSTS`文字列は分類にも描画にも使用しない。Microsoftの一次資料で`AADSTS65004`は`UserDeclinedConsent`であり、個人アカウントにも起こり得る。
- raw error、説明文、メールアドレス、tenant IDは表示しない。他組織のtenant設定や同意をKAQ側で代行しない。本人のMFA/CAPTCHAも自動化しない。

## 自動検証

- registry、flag無効時の非表示、backend、最小scopeを単体で検査する。
- 実GoTrueで`common` tenantへのMicrosoft認可開始、PKCE callback、認証済みKeycloak利用者のMicrosoft identity連携開始を検査する。
- 実Microsoft本人ログインは外部アプリ有効化後の公開証跡で確認する。未有効化を利用可能とは報告しない。

## 一次資料

- https://supabase.com/docs/guides/auth/social-sign-in/auth-azure
- https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes
- https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/troubleshoot-consent-issues


## 外部設定の実施記録（2026-11-20）

Entra ID Freeの専用アプリを登録し、個人用・組織用の両方を対象に本番Supabase callbackを設定した。ID tokenにemail/xms_edov、access tokenにxms_edovを保存し、Supabaseのcommon tenant接続を有効化した。認証情報はMacキーチェーンへ保存し、値は本書へ記録しない。クライアントシークレットの実期限は2028-11-19であり、Supabase管理トークンのNever設定とは異なる。

本番のMicrosoftボタン表示後、本人の情報共有同意を得て個人用Microsoftアカウントで実ログイン成功を確認した。日本語のcallback→dashboard、オンライン検証済みアカウントとMicrosoft identity、再読込後のsession維持、logout後の公開ホーム、再ログインまで確認済み。scopeは基本プロフィールとメールだけであり、メールボックスやOneDriveの権限は要求していない。組織用アカウントは各組織の同意ポリシーにより管理者承認が必要になる。発行元の検証バッジは未取得。
