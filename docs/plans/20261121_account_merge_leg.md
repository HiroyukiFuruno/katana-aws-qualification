# #58 SSO確認legのprivateメタデータ制御（ローカル検証済み・未公開）

一次要件は[proof](20261121_account_merge_proof.md)、[intent](20261121_account_merge_intent.md)、[runtime DB](20261121_account_merge_runtime_db.md)。この単位はowner-onlyのprepare/replay/明示restart/期限・試行回数制御に限定する。

## 対象と禁止事項

- 既存legへprepare用idempotency keyとrequest hashのnullable pair・hash長・非zero key・intent/side/key UNIQUEを追加する。既存行のNULLを維持し、既存migrationを編集しない。新しい関数が作る行は必ず両方を埋める。
- `issue_account_leg(intent_id, intent_secret, side, expected_intent_revision, idempotency_key, nonce_hash, replace_active=false)`をowner-onlyで実装する。nonce hashは信頼する内部callerだけの32byte入力であり、公開RPCの引数にしない。
- leg UUID、canonical storage key、DB発行時刻と期限はSQLで生成する。発行/期限を整数millisecondへ切り下げ、期限はintent期限と3分の早い方で固定する。
- 返却は自身のintent/leg状態・revision・attempt・canonical guardだけ。raw nonce/hash、verifier/token/ciphertext、URL、他人のプロフィールは返さない。
- 新しいaccount/state/member/grant/proof/runtime blobを作らない。target UID/account/epochの制約も変更しない。
- Edge/公開wrapper/grant、SDK、認可URL、exchange claim、GoTrue呼出し、署名proof受理、preview/commit/owner切替を含めない。

## 冪等性・状態・lock

- request hashはside/期待revision/nonce hash/replace flag/主sessionを正規化して固定する。同じkeyの同じbodyは同じlegへ収束し、違うbodyはconflict。再送で新attemptや新期限を発行しない。
- sourceはawaiting_sourceだけ、expected UIDはactor。targetはawaiting_targetだけ、expected UIDはNULL。source未確認のtargetは拒否する。
- actor advisory→intent→主Auth user/session→同じsideのlegをattempt順でlockする。user/session/claimは全待機後にも再検査し、Auth→intent逆順やnetwork中のDB lockを作らない。
- 新規keyは現在のintent revisionを要求し、新leg作成でintent revisionを一回進める。active legがあるときはreplace_active=trueだけを明示restartとする。
- restartは同じsideのissued/exchanging/exchangedをsupersededへ進め、revisionも進める。既存runtime関数がexchangedを作れるため「存在しない」と仮定しない。provedや既存terminalを再openしない。
- issuedのleg期限切れ、exchangingの期限切れ、exchangedのproof期限を区別する。exchangedはlegの3分期限だけでは失効させず、intent期限まで扱う。SQL null/不正型/未知ID/actor・session・secret不一致は変更0で拒否する。
- 一sideは最大3行、失敗・unknown・supersededも試行を消費する。4回目はintentをattempts_exhaustedへ進め、legを作らない。このterminalの更新を例外rollbackで取り消さず、固定された結果として返す。
- intentの取消し/期限切れも新規発行不可。正しい再送は既存leg/終了状態だけを返し、activeへ戻さない。nonceを失った内部callerは同じlegへ別nonceを上書きせず、明示restartを使う。

## 後続の暗号化envelope

SQLが生成するUUID/時刻は返却後に初めて分かるため、暗号文を本関数の入力に要求しない。後続で既存AES-GCM payloadを`{slots, ingestNonce}`へ拡張し、SDK用key/基底session JSONへnonceを混ぜず、slot更新とproof promotionでもenvelope全体を保持する。canonical contextの取得後に初期runtimeを保存し終わるまで、認可URLもexchange claimも許可しない。

この暗号化/公開capabilityは本単位の検証済み機能ではない。server-only nonce操作と、raw nonceを返さない公開prepareを混同せず、後続実装で能力境界を検証する。

## 検証条件

- [x] 実GoTrue/Postgresの主sessionを使い、canonical key/DB時刻/TTL/UID/attempt/revisionとopaque hashを照合する。
- [x] 再送・異なるbody・stale revision・replace flag・side順序・3回制限・terminal維持を回帰化する。
- [x] 並行prepare/replay/restart/cancel、leg待機後の失効、旧runtimeの失効をDB lock/時計と前後snapshotで照合する。固定sleep/Mock/timeout延長は使わない。
- [x] 全API roleのtable/functionアクセス拒否と、既存行/ownerデータ不変・専用fixture cleanup・全入力SHA一致を検査する。
- [ ] 標準runner・全check・独立レビュー・Draft→指摘対応→Ready→必須CI→merge→公開を回収する。#58全体の完了へ代用しない。

## ローカル検証の回収

標準`account:integration`の全工程が成功（`test-results/account-merge/leg-final-standard.log`）。実2OIDC・既存private部品・locking108条件/12競合・intent83条件/9競合・runtime121条件/5競合に続き、本単位40条件/6競合、実3ユーザー/4sessionを照合した。最終receiptは04:27:08UTC、34入力SHA一致・全snapshot復元・deadlock0・専用container2個削除を確認。テスト内のfractional epoch変換による失敗は`leg-polish-parse-red/`に保存し、SQLで整数化して標準全工程を再実行した。

固定候補`a1ff066b0dfcc65c87dbb28820ca21e836b6db8f`は全check697件/4109assertion・account型検査が成功。暗号化envelope・実SDK経路・署名proof・履歴統合の完了とは扱わない。正式PR/CI/公開は未完。
