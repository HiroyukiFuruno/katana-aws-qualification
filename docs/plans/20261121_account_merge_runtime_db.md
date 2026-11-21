# #58 暗号化runtimeのDB側CAS契約（未実装）

一次要件: [proof](20261121_account_merge_proof.md)、[暗号化部品](20261121_account_merge_runtime.md)、[ロック順](20261121_account_merge_data.md)。この単位はowner-only SQLと実DB検査に限定する。

## 固定する対象と禁止事項

- 新規の未登録private DDLで既存`account_proof_runtime`へ`phase`（leg/proof、既定leg）を追加する。既存migrationは編集しない。
- owner-onlyのread/terminal/CAS/guard付きcleanup/leg→proof promotionを実装する。固定search_pathと明示REVOKEを維持し、全API roleへの直接table/functionアクセスを閉じる。
- 公開wrapper、schema公開、service-role grant、Edge実行経路、鍵発行、proof受理、学習grant、owner移動、実利用者操作は追加しない。

## 原子的な正本照合

- intent→leg→runtimeの順でlockする。存在しないruntimeの初回CASもleg lockで直列化する。actor側intent操作のadvisoryと逆順で追加取得しない。
- guardはpurpose/intentId/legId/attempt/storageKey/issuedAt/expiresAtの全項目を正本へ照合する。時刻はDB由来の整数millisecondへ切り下げ、期限を延ばさない。JSで表現できない微小秒との差を黙って無視しない。
- leg contextはleg発行時刻・leg期限、proof contextは同じleg発行時刻・intent期限に固定する。proofに移行してもTTLを新規に発行し直さない。
- CASはactive intent・許可されたleg状態・phase・DB時刻・期待revision・次revision=current+1・固定expiry・key version・nonce12byte・ciphertext最小16byteを同一transactionで検査する。
- promotionはexchanging legの旧context/revisionと新proof contextを照合し、新暗号文/revision+1/phase proof/leg exchangedを一度に確定する。交換成功や本人確認の証明とは扱わない。
- promotion後のproofはintent期限まで読める。legの3分期限を理由にproofを失効させない。superseded/failed/exchange_unknownやintent終了は別途拒否する。
- cleanupはactive/期限を要求しないが、元の正規phase/contextとrevisionを必ず照合する。古いlegのcleanupで新proofを削除しない。

## 実行・検証条件

- [x] 専用Postgres/GoTrueと既存14migrationで実行し、全入力SHAと開始/終了時のデータを照合する。ITのMock・固定待機・timeout延長は禁止。
- [x] 初回CAS並行実行、古いrevision、guard各項目の変更、期限切れ・取消し・supersedeを拒否し、意図外変更0を検査する。
- [x] promotionの一回性・revision単調性・leg期限後のproof有効性・旧context書込/削除拒否・cleanup競合を実lock/DB時計で検査する。
- [x] ロール別table/function ACLを全件照合し、public/anon/authenticated/service_roleからの越境0を検査する。
- [ ] 検査の標準runnerへの接続、型・構造・全check、独立レビュー、Draft→指摘対応→Ready→必須CI→merge→公開を回収する。

DB接続のない暗号化部品の単体成功を本件の完成へ代用しない。逆にこのprivate CAS単位の成功を公開OAuth・統合全体の完成へ代用しない。外部GoTrue交換とDB保存は非原子的で、交換結果不明時の新legへのやり直しは後続フローで実装する。

## 実装・検証の回収

`runtime-schema.sql`はphase列だけを追加し、`runtime-storage.sql`は固定contextのread/terminal/CAS/cleanup/promotionをowner-onlyで実装した。初回runtime不在を誤ってterminalとする点、JSON nullのSQL三値論理による検査通過、proof状態・intent期限・key version・JS安全整数の不一致を実DB回帰で修正した。`runtime-db-null-guard-red/`は不正null revisionを受理したRED、`runtime-db-final-green/`は修正後121 SQL条件/実5競合のGREENを保存する。

`runtime-db-standard.log`: 標準`account:integration`全体exit 0。実2issuer/既存private検査、locking 108条件/12競合、intent 83条件/9競合の後にruntime 121条件/5競合を成功した。runtimeのreceipt（03:02:57 UTC）は30入力SHA一致・deadlock 0・開始/終了snapshot一致・専用2コンテナ削除を記録する。実暗号文や鍵はこのDB検査へ渡さず、opaqueな固定テスト値を使う。SDKの実暗号化/AAD/秘密秘匿は別の純runtime単体検査の責務であり、ここで実OAuth交換や復号まで成功したとは報告しない。

`runtime-db-final-review.md`: SQL/検査の入力SHAと新しい標準receiptを独立照合し、このprivate単位の残存P0/P1/P2なし。`runtime-db-typecheck.log`も成功。標準check・Draftレビュー・CI・公開の回収を続ける。

最終差分整合性検査でPythonの末尾空白一箇所を修正後、`runtime-db-final-standard.log`で標準runner全体を再度成功確認した（runtime receipt 03:07:50 UTC、121条件/5競合・30入力SHA一致・deadlock 0・snapshot復元・cleanup成功）。独立レビューもこの新receiptへ再束縛済み。`runtime-db-candidate-check.log`は固定候補tree `4682b850f3a43f4f00f6c15589b6ae519c043b92`で標準check 697件/4,109検証、重複0・辞書/直書き/型/教材/構造/build、追加account:typecheckを全て成功確認した。入力archive/lockfile SHAは`runtime-db-candidate-source.json`に保存した。
