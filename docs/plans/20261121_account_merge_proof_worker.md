# #58 proof受理を呼び出すserver worker部品

一次要件は[proof契約](20261121_account_merge_proof.md)。署名JWTを受理するSQL本体・fixture wrapper・本番Edge/権限・owner移行とは分け、server-only workerと単体回帰を先にレビューする。

## 実装範囲

- main session/intent secretを検証したcanonical controlから正規legを得る。browser持込みのJWT/UID/SIDはAPIとして受け取らない。
- proof phaseの暗号化storageだけから公式SDK sessionを復元し、同一projectのgetUser(explicit token)へ渡す。initialize/getSession/refresh/code交換は呼ばない。
- SQL portへ渡すJWT/nonceはserver内だけで使う。署名検証とUID/SID導出を行うPostgREST/SQLの実装は後続の接続単位で検証する。SIDの形式確認を署名検証と呼ばない。
- DB受理後、canonical legの束縛とproved UID/SIDを再確認してからnonceだけをCAS消去する。session/元の期限を保つ。
- 確定済みproofのmetadata再送は認証済みcontrolのrecordから返し、Auth照会やcleanupの失敗を公開応答の失敗へ変換しない。nonce cleanupだけは保存sessionのUID/SID照合を維持する。
- commit後応答喪失・nonce消去失敗は次の同一要求でmetadata/cleanupへ収束し、code交換やproof受理を重複させない。DB保存前の失敗ではnonceを残す。
- 公開結果はintent/leg/state/期限と汎用failureだけとし、例外本文・token・nonce・相手UID/SIDを含めない。

## 対象

`supabase/functions/account-linking/server/proof-worker*.ts`、`scripts/account-linking-server-proof-worker*.test.ts`。

## この部品の検証

- [x] 17 UT / 65 assertions。UTの外部port fakeは許可する。
- [x] 正常・DB保存前失敗・commit後応答喪失・CAS消去失敗・canonical六種変更・getUser/期待UID失敗・欠落/不正SID・proved SID不一致。
- [x] 独立workerレビューのP0/P1なし。P2の欠落/不正SID回帰を追加済み。
- [x] 初回immutable候補6d2b8917で全check成功（784 UT / 4474 assertions）、型2系統、150行、重複0、build。初回コミット時の後続変更は進捗行のみ。追加レビューの修正は下記へ記録する。
- [ ] Draft PR→正式レビュー/指摘対応→Ready→必須CI→通常merge/公開。

## PR94追加レビュー

- [/] P2 / 4651688088: proved metadataをgetUser成功へ依存させない。nonceが残る/消去済み双方のAuth障害と、SID不一致ではnonceを消さないことを回帰で検査する。
- [/] P2 / 4651688091: sourceのexpected UID欠落はAuth/SQL/cleanup前に拒否する。targetの未確定UIDを一律に拒否しない。
- [x] 最新immutable候補c2c5015で全check795件/4546 assertions、型2系統、重複0/buildが成功。
- [ ] 元threadへの返信/resolve、最新head再レビューを回収する。

追加回帰は修正前13成功/4失敗、修正後17成功/65 assertions。proof-worker-review-regressions-{red,green}.logへ記録。親SDK修正86dd120をmergeしてから検査し直す。

この部品だけでは実SSO→署名HTTP→SQL proof受理は完了しない。SQLと実fixtureの別変更で検証・公開し、#58全体の残DoDを保持する。
