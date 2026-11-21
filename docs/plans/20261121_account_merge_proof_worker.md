# #58 proof受理を呼び出すserver worker部品

一次要件は[proof契約](20261121_account_merge_proof.md)。署名JWTを受理するSQL本体・fixture wrapper・本番Edge/権限・owner移行とは分け、server-only workerと単体回帰を先にレビューする。

## 実装範囲

- main session/intent secretを検証したcanonical controlから正規legを得る。browser持込みのJWT/UID/SIDはAPIとして受け取らない。
- proof phaseの暗号化storageだけから公式SDK sessionを復元し、同一projectのgetUser(explicit token)へ渡す。initialize/getSession/refresh/code交換は呼ばない。
- SQL portへ渡すJWT/nonceはserver内だけで使う。署名検証とUID/SID導出を行うPostgREST/SQLの実装は後続の接続単位で検証する。SIDの形式確認を署名検証と呼ばない。
- DB受理後、canonical legの束縛とproved UID/SIDを再確認してからnonceだけをCAS消去する。session/元の期限を保つ。
- commit後応答喪失・nonce消去失敗は次の同一要求でmetadata/cleanupへ収束し、code交換やproof受理を重複させない。DB保存前の失敗ではnonceを残す。
- 公開結果はintent/leg/state/期限と汎用failureだけとし、例外本文・token・nonce・相手UID/SIDを含めない。

## 対象

`supabase/functions/account-linking/server/proof-worker*.ts`、`scripts/account-linking-server-proof-worker*.test.ts`。

## この部品の検証

- [x] 14 UT / 52 assertions。UTの外部port fakeは許可する。
- [x] 正常・DB保存前失敗・commit後応答喪失・CAS消去失敗・canonical六種変更・getUser/期待UID失敗・欠落/不正SID・proved SID不一致。
- [x] 独立workerレビューのP0/P1なし。P2の欠落/不正SID回帰を追加済み。
- [x] immutable候補6d2b8917で全check成功（784 UT / 4474 assertions）、型2系統、150行、重複0、build。以後の変更はこの進捗行のみ。
- [ ] Draft PR→正式レビュー/指摘対応→Ready→必須CI→通常merge/公開。

この部品だけでは実SSO→署名HTTP→SQL proof受理は完了しない。SQLと実fixtureの別変更で検証・公開し、#58全体の残DoDを保持する。
