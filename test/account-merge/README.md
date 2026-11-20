# アカウント統合用の実境界検証

実行: `rtk proxy bun run account:integration`。専用fixtureの型検査: `rtk proxy bun run account:typecheck`。

専用compose project `kaq-account-merge-integration`でPostgres 18、GoTrue 2.198.0、PostgREST 14.1、Keycloak 26.8.2を起動する。14migrationは`scripts/data-migrations.ts`の宣言順で適用し、実ファイルとの漏れ/重複を拒否する。既存Auth/Progress suiteとはポートを共有しない。

| localhost port | 用途                          |
| -------------- | ----------------------------- |
| 54530          | GoTrueとPostgRESTのgateway    |
| 54533          | 検証専用ブラウザー画面        |
| 54541          | 実KeycloakのHTTPS・2つのrealm |

1つのGoTrueとDBに2つのOIDC issuerを接続する。realm `merge-first`はkeycloak adapter、`merge-second`はazure adapterの設定可能なauthorize/token URLから実Keycloakへ透過forwardする。2本目はMicrosoft実サービスの再現ではなく、独立issuerによる実OAuth/署名/所有者境界の検証である。discovery/JWKS/token/userinfoは実Keycloakが返し、応答やclaimを合成しない。custom providerのprivate-network拒否やTLS検証は無効化しない。

テスト専用画面は公式SDKの独立PKCE storageを使う。製品画面へログインした後の自動遷移やonboardingの期待値は固定しない。学習state作成はRLS smokeの明示fixture操作である。

foundation適用前に、GoTrue Admin APIで専用の合成ユーザーを一件だけ作り、既存公開RPCの検査を通して全12owner表に履歴・draft・profile・manifest・lesson・dashboard設定を投入する。これは移行入力のfixtureでありSSO所有証明の代用ではない。非公開基盤の適用前後で全13public表の件数/全内容hash、schema/owner/ACL/column ACL/関数/trigger/制約/index/policy/default ACLを比較する。検査後、その合成UIDだけを公式Admin APIで削除し、Auth404と全12表の残件0を確認する。既存18教材は全内容を変更しない。

続いて実2issuerのOAuth・REST境界と、private10表のACL/RLS/FK/check/uniqueを検証する。private検査は明示BEGIN/ROLLBACKで行い、public全内容とAuthのuser/session/identity/AMR全列hash復元、private空を確認する。private schemaをRESTに指定しても匿名・両JWTから406になることを検証する。

DoDは、異なるAuth UID、同一DBのlive sessionとOAuth AMR、issuerの相違、両ユーザーの自己read/write、他者read拒否、直接write拒否、匿名拒否が実際に成功すること。ログは`test-results/account-merge/integration/`の`integration.log`、`services.log`、`smoke-proof.json`、Playwright結果へ保存する。token/password/verifierは成功証跡へ書かない。

runnerは終了時に専用projectをdownする。既存compose projectや実利用者を操作しない。失敗して残った合成メールを探索・再利用・削除せず、専用projectの再作成で再試行する。この足場の成功は、まだ未実装の#58統合機能・製品onboardingの完了を意味しない。
