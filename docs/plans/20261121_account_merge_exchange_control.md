# #58 認可開始とcode交換のprivate claim（ローカル検証済み・未公開）

一次要件: [proof](20261121_account_merge_proof.md)、[leg](20261121_account_merge_leg.md)、[envelope](20261121_account_merge_envelope.md)。次の実SDK接続で、同一legを複数workerが同時に開始/交換しないためのDB制御に限定する。

## 対象と境界

- 新しいmigrationではなく未登録private sourceへ、legのauthorization_claim_id/request_hashのnullable pair、authorization_prepared_at/runtime_revisionのnullable pairを追加する。旧行のNULLを維持し、既存migrationは編集しない。
- claimed pairはUUID非zero/hash32byte、prepared pairはclaim必須・時刻/非負JS-safe revisionを検査する。新関数は必ず整合したpairを書き、値をリセットしない。
- private owner-onlyのclaim authorization、complete authorization、claim exchange、fail legを実装する。provider/callbackのrequest hashはtrusted serverだけの入力で、browser RPCへ出さない。
- code、raw nonce、verifier、token、ciphertext、認可URL、相手UID/プロフィールを引数/結果/監査へ加えない。new account/state/member/grant/proofは作らない。
- 全API roleのEXECUTEをrevokeし、public wrapper/Edge/SDK呼出し/本番DB変更は含めない。

## 認可開始

- claim authorizationはmain actor/session/intent secret、leg ID/revision、expected runtime revision、request hashを照合する。intent active、leg issued/live、同じleg phase/固定期限のruntimeが存在することを要求する。
- server workerは別途、envelopeからnonce/hashを確認してからclaimする。SQLが暗号文の中身やPKCE verifierの存在を検証したと読み替えない。
- 初回だけclaim UUIDをDBで生成してleg revisionを一回進める。同hashの再送はclaimed=false/recovery_required=trueで同じleg状態へ収束し、別hashはconflict。SDKを二度開始する権限にしない。
- complete authorizationはclaim UUID/期待leg revision/固定runtime contextと実際に保存したruntime revisionを照合してpreparedを確定し、leg revisionを一回進める。再送は同じ確定結果で、新時刻/新期限を出さない。
- 認可URLは公式SDKから一度だけ返す。HTTP応答/URLを失った再送へ新しいPKCEを黙って生成せず、同じlegのmetadataと明示restart要求を返す。URL自体はこのDB制御へ保存しない。begin intentのsecret再送と同じく、無断の再発行で救済しない。

## code交換

- claim exchangeは同じmain actor/session/secretと期待leg revisionを再検査する。prepared済み、leg issued/live、runtime phase/context/期限/revisionがprepared時と一致した場合だけexchangingへ一回進める。
- 既にexchanging/exchanged/provedならclaimed=falseのstatusを返し、同じcodeや別codeを再交換しない。stale/別claim/変更runtimeは変更0で拒否する。
- SDK/network呼出しはclaim transaction終了後に行う。OAuth待ちでDB lockを保持しない。
- fail legは同じclaim ID/期待revisionだけを対象に、認可開始失敗はissued→failed、交換の確定失敗/結果不明はexchanging→failed/exchange_unknownへ進める。unknownはexchangingだけ。raw errorや任意reasonは保存しない。
- exchanged/proved/終了intentを遅い失敗で書き換えない。既存runtime promotionがleg revisionを進めるため、古い失敗通知はproof blobを消さずstaleにする。
- TTL、attempt、intent revision、main bindingを勝手に更新/延長しない。失敗は既存の3 attemptへ数え、次legは既存の明示restartを使う。

## lockと待機後の検査

actor advisory→intent→main Auth user/session→leg→runtimeの順を守り、後からAuth/state/account lockを追加しない。既存intent helperを再利用し、全待機後に署名claim/sessionとintent/leg/runtimeの時刻・revisionを再検査する。expired intentをsettleする更新は例外rollbackで失わせず、終了状態として返す。未知ID/不正secret/他actor/sessionは第三者legのattemptを消費しない。

## 再送とstaleの判定順

設計レビューの指摘を採用し、初回操作によるrevision進行を正しい再送の拒否理由にしない。各操作は引数の形状→actor/secret/所有関係→全待機後のlive/expiry settle→既処理の再送/status判定→初回の期待revision/state/runtime照合→更新、の順とする。

- claim authorization: 同hashの既存claimは元の期待leg/runtime revisionでもrecoveryを返す。違うhashはconflict。
- complete authorization: 同claim UUIDと確定済みprepared runtime revisionの再送は、新時刻や新権限を作らず現在statusを返す。違うclaim/runtimeはconflict。
- claim exchange: 既にexchanging/exchanged/provedならstatus/claimed=falseだけを返す。これはcodeを再交換する権限ではなく、初回issuedでのstaleは拒否する。
- fail leg: 同claim・同じfailure kind・元expected revisionの直後のterminal revisionだけを完全一致の再送として扱い、更新しない。違うkind/revisionはstaleとし、終了intentへのstatus返却とも区別する。

同じ旧expected revisionでclaim/complete/failを連続再送し、2回目以降のrevision/時刻/runtime/attemptが不変であることを実DB回帰に含める。

検査のholderもlock順を守る。runtimeを保持して待機callerが保持済みのleg/intentを更新する方法は、人工的な逆順deadlockを作るため使わない。期限は待機開始前にDB時刻で設定し、blocked edgeと期限前を観測してからDB時計の期限到達で解放する。取消しを先に確定するケースではactor advisoryを先に持つholderが取消しを実行し、待機callerをその後に再開する。

## 実行可能な検証

- [x] 実GoTrue/Postgresのverified main sessionで正常claim/再送/違うbody/状態/固定TTL/非露出を検査する。
- [x] NULL/型/JS-safe境界、不在/phase違い/変更runtime、claim違い、side/intent不整合、prepared前、stale failureを変更0のsnapshotと組にする。
- [x] 並行authorization claim、並行exchange claim、finishとrestart/cancel、runtime更新とexchange、遅いfailureとproof promotion、lock待機中の期限切れを実DB barrierで検査する。固定sleep/Mock/operation timeout延長は使わない。
- [x] 全API roleのACL、source SHA一致、auth/public/private全row snapshot復元、deadlock0、owned fixture削除を回収する。拒否済みshort JWT操作は再実行しない。
- [ ] 標準runner/full check/独立レビュー/Draft→指摘対応→Ready→必須CI→通常merge→公開を回収する。

実server SDKの認可URL/交換、PostgREST署名proof、owner/fence/履歴統合は後続。metadata claimだけでそれらの利用可能性を完了扱いにしない。

## 最終ローカル検証

標準account:integration全工程が成功（exchange-final-standard.log）。本単位125 SQL条件/125 unique namesと7実DB競合、実GoTrue3ユーザー/4session、38入力SHA一致、auth/public/private全row snapshot復元、deadlock0、専用container2個削除を照合。最終receipt06:09:23UTC/cleanup06:09:35UTC。固定候補402fa9b8は全check735件/4251assertion・account型・Biomeが成功し、exchange-final-review.mdはP0/P1/P2なし。

検査作成時のrevision期待値・引数順・競合投入順・fixture変数の失敗と修正後の成功はdebug系の試行記録に保存した。初期coreの実測は58条件であり、作業者の推測53を採用せず、境界追加後125へ固定した。未準備/不在runtime/phase/side/NULL/型/JS-safe/constraintを独立入力で検査し、拒否の前後は全row hashで比較する。actorの別sessionも同一Auth UIDの実sessionで検査する。

認可URL/実SDK/署名proof/owner移動は本単位の完成範囲ではない。正式Draftレビュー・CI・merge・公開は未完。GitHubの実行開始制限を回避しない。証跡: test-results/account-merge/exchange-{candidate-source.json,candidate-check.log,final-standard.log,final-review.md}。
