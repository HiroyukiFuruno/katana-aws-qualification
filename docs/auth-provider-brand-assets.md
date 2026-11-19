# 認証プロバイダーのブランドアセット

ログイン画面では、有効なプロバイダーに限り公式の未改変ベクターを使用する。ロゴは装飾目的なので代替テキストを持たせず、ボタンの翻訳済みラベルで操作内容を伝える。

|プロバイダー|配置ファイル|一次配布元|
|---|---|---|
|GitHub|`public/auth/github.svg`|[GitHub Brand Toolkit](https://brand.github.com/foundations/logo) の公式ロゴ配布物|
|Google|`public/auth/google.svg`|[Google Firebase UI の公式アセット](https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg)|
|Microsoft|`public/auth/microsoft.svg`|[Microsoft Entra の公式 SVG](https://github.com/MicrosoftDocs/entra-docs/blob/main/docs/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_mssymbol_19.svg)|
|Facebook|`public/auth/facebook.svg`|[Meta 配布 CDN の公式 SVG](https://static.xx.fbcdn.net/rsrc.php/y1/r/4lCu2zih0ca.svg)|

Facebook は現時点で認証 registry に含まれないため、無効なボタンを追加しない。認証を有効化したときは、同じ公式ベクターとFacebook Blueを使う。
