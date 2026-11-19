# ADR 0001: Supabase AuthによるSSO共通基盤

## 決定
- #18ではSupabase公式の軽量な `@supabase/auth-js` を使用する。DB/Storage/Realtimeはまだ不要なためフルSDKを含めない。
- Auth adapterをKAQの認証契約へ適合させ、ReactはSDKに直接依存しない。provider固有設定はregistryへ集約する。
- 組込みproviderと `custom:` providerを同じ契約で扱い、Amazonなど後続でcallbackを複製しない。
- PKCE・セッション更新・検証済みidentity連携はSupabaseに委譲する。ユーザー所有権はuser IDで判定し、メール一致による独自統合は行わない。
- 認証用ページの静的シェルはnoindexとし、sitemapから除外する。callbackのqueryは処理前にURLから消し、GA4を起動しない。

## 型定義の互換性
TypeScript 7のDOM定義ではPublicKeyCredential.toJSONが標準化されている。
Auth JS 2.119.2のPublicKeyCredentialFutureは、旧版のJSON型を返す同名メソッドを再定義し、型の継承条件に違反する。
`skipLibCheck` 等で検査を無効化せず、BunのpatchedDependenciesで拡張元を
`Omit<PublicKeyCredential, 'toJSON'>` とし、SDK自身のtoJSON定義を保持する。
main/module両方の型定義に同じ1行修正を適用する。実行コードは変更しない。
SDK更新時には、パッチを外した状態の型検査を再評価する。

## 検証
- SDK境界をmockする単体テストで失敗・遅延・連携制約・session競合を検査する。
- Docker上の本物のSupabase Auth/Postgres・Keycloak OIDCで、正常系と公開入口設定を検査する。
- Keycloakはテスト専用であり、利用者向けの第6のSSOとして公開しない。
- GitHubは認証開始redirectを実Authで確認し、GitHubアプリ自体の有効化は別途実設定を確認する。
