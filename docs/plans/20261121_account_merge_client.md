# #58 ブラウザーのowner切替契約（実装前）

一次要件はIssue58と既存の統合・データ・proof契約。以下は実装予定であり、画面/保存/公開の成功記録ではない。

## 所有者の型と送信

- Auth UID、logical account ID、membership epoch、DB learning generation、ブラウザーstore世代、session IDを別fieldにする。現在の`MemberProgressOwner.userId`へlogical accountを代入して流用しない。
- Auth token取得とAuthState比較にはAuth UIDを使う。DB queryの所有範囲にはserver bootstrapが返したaccount ID/epochを使い、全REST/RPCへ固定headerを送る。client headerは権限証明ではない。
- progress、模試、基礎学習、dashboard、移行、設定、reset/退会のAPIを同じbindingへ揃える。どれかを旧Auth UID所有のまま残さない。
- current判定はAuth UID/session、account/epoch、store世代とstore instanceを含める。古いread応答・save応答・再試行で新しいownerの画面を書き換えない。
- PostgRESTのHTTP409/`PT409`だけでgeneration resetと判断しない。固定されたmachine reasonを境界で分類し、`KAQ_SCOPE_RETRY`は同じcommand IDの再試行、epoch/grant失効は再認証/隔離、未membershipはsetupへ分ける。生のserver messageを画面へ表示しない。

## 初回SSOとbootstrap

- 新SSO認証によるAuth user作成と、KAQ学習account作成を分ける。readyになる前にProgressStore・学習state・guest import・queue送信を開始しない。
- `onboarding_required`は「既存KAQへ追加／新規作成」の明示選択へ進む。候補はenabled providerや本人が明示したログイン方法に限定し、名前/メール検索や未検証プロフィールの一覧を作らない。
- 新規作成は本人のcreateNew一回だけで確定する。既存への追加は双方fresh proofと最終同意を経る。callback取消し/期限/誤認証で新規作成へfallbackしない。
- `reauthentication_required`とdisabledをguestや未登録へ変換しない。既存grantなしの新OAuthは明示enrollを経てbootstrapを再読する。bootstrap自身はgrantを作らない。
- readyのログイン後ホームはdashboard。未割当時だけsetupへ案内し、未確定のままDB保存を始めない。

## queueと旧ブラウザー

- outboxは元Auth UID/account/epoch/generationへ束縛し、command IDと原payloadを保持する。統合/再認証に合わせて最新ownerへ書き換えたり自動flushしたりしない。
- owner遷移時に`dispose(true)`やoutbox.clearで未送信記録を破棄しない。隔離と通知、元scopeでの同期、receipt/正本との明示照合を分ける。
- 別端末の未送信件数をpreviewのDB件数へ含めたと主張しない。サーバーが確認できた履歴だけを同意対象として表示する。
- legacy v1 queueの自動互換はserver確認済み未統合1:1/epoch0に限定する。統合済みscopeでは原文を保持し、本人の明示復旧なしに昇格しない。
- ログイン後の履歴正本はDB。pending commandの一時永続化は全履歴のcookie二重管理とは区別し、会員の新しい履歴をcookieへ増分保存しない。

## 統合後・解除・退会

- commit後のmainは旧sessionなので、新OAuth再認証後に新binding/storeを開始する。Edge内proof credentialをbrowser mainへ移さない。
- 承認済みproof grantの例外はproof/committed receipt/epoch/fenceへ束縛する追加DDLが必要。`reason='proof'`だけで通常fenceを迂回させない。
- 同一Auth UIDの公式identity unlink、Auth membershipのKAQ切離し、KAQ全体退会を別操作として示す。最後の利用可能ログインをaccount全体で保護する。
- detached/disabledは自動onboardingへ戻さない。解除後の明示再連携を実装する際も、現在ownerと解除済Auth UIDの双方fresh proofで認可し、tombstoneを暗黙復活させない。
- 全体退会は全membershipをfenceし、全内容を消去してから公式Admin APIで各Auth userの削除/404を確認する。一部失敗を完了表示せず、同意済み操作の短命capabilityで冪等再試行する。

## 検証・未実装

- [ ] 実2 OIDC/DBで新SSO→既存への追加→共通保存先→両SSO再ログインの同一履歴を検証する。
- [ ] queue保持、旧応答、UID/session/owner/epoch切替、再送、reset/退会、旧clientを実境界で検査する。
- [ ] setup/双方確認/preview/競合選択/結果/再認証を全10言語・mobile・keyboardで検査する。
- [ ] 全caller/FK/RLS/cutoverを揃えてレビュー/CI/公開する。実利用者の統合・削除は未承認のまま実行しない。
