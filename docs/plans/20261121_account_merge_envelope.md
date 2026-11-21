# #58 SDK slotとingest nonceのsealed envelope（ローカル検証済み・未公開）

一次要件: [proof](20261121_account_merge_proof.md)、[leg](20261121_account_merge_leg.md)、[runtime](20261121_account_merge_runtime.md)、[cleanup](20261121_account_merge_runtime_cleanup.md)。cleanupの内部interface補強後に着手する。

## 対象

- 既存AES-GCM payloadを`{slots, ingestNonce?}`へ拡張する。新しい暗号方式・鍵管理・sidecar tableは作らない。nonceはSDKのkeyでも基底session JSONのfieldでもない。
- Envelopeは非arrayのstring map `slots`と任意のlowercase hex64 `ingestNonce`だけを許可する。unknown root field、array/null slots、不正nonceは拒否する。既存の未公開`{slots}` payloadはnonce無しの形として読める。
- encrypt/decryptEnvelopeを提供し、既存encrypt/decryptSlotsはslotsの投影として互換を保つ。context/key versionのAADと固定TTLは維持する。
- SDKのset/removeはenvelope全体を読み書きしてnonceを保持する。getItemはSDK keyだけを認め、nonceを返さない。provider token除去も維持する。

## 内部worker用メソッド

- `initialize(ingestNonce, expectedHash: Uint8Array[32])`: leg contextのruntime不在時だけCAS作成する。同じnonce/hashの再送は書込なし。別nonce・既存のnonce無しrecordへの後付けは拒否し、lost nonceをresetしない。
- `getIngestNonce(expectedHash)`: nonceを復号し、raw32byteのSHA-256が信頼する内部leg hashと一致する場合だけ内部workerへ返す。expectedHashはawait前にcopyし、外部のmutable配列に束縛判定を委ねない。
- `clearIngestNonce(expectedHash)`: proof contextだけでnonceを除去し、SDK session/verifierは保持する。消去後の再initializeは拒否する。signed-proof receiptの確認や消費は後続server処理の責任である。
- initialize/clear/SDK mutation/terminateは同一FIFOを共有する。readは並行可能だがdigest/decrypt/key/CASの各await前後にliveを再検査する。
- nonce_missing/nonce_mismatch等は固定コードだけを返し、raw値/hash/下位例外本文/causeを出さない。内部エラーも元コードから新しく生成する既存の秘匿を維持する。

## 接続順序と境界

内部workerがnonceとhashを生成→private leg metadata発行でcanonical ID/DB時刻/key取得→envelope初期CAS→SDK初期化/認可URL、の順とする。nonce永続化前のURLやexchange claimは実装しない。metadata発行後にnonceを失ったら、新しいkeyの明示restartが必要となる。

promotionはenvelope全体を別のproof context/intent期限で再暗号化し、既存DB promotion CASに渡す。同じstorage instanceのcontextを変更せず、DB phase遷移の権限をこの純部品へ持たせない。trusted hash引数をbrowserの権限証明へ使わず、最終proof SQLでも独立に照合する。

## 検証

- [x] 実WebCryptoでstrict shape/nonce/hash、投影非露出、slot保持・provider token除去、再送/競合/消去後の再初期化拒否を検査する。
- [x] 実Promise barrierでawait中のexpiry/terminal/hash配列変更・FIFOを回帰化する。MemoryRepositoryは単体だけに使い、IT成功と呼ばない。
- [x] envelope全体のproof AAD再暗号化・旧context拒否・固定期限・key rotationを検査する。
- [ ] 既存runtime/cleanup単体と型・150行・重複・全check・独立レビュー・Draft/CI/公開を回収する。

Edge公開経路、実SDK/GoTrue OAuth交換、署名proof受理、owner/fence/履歴統合は本単位で実装済みとしない。未公開private部品への拡張であり、旧Edge workerのrolling互換を検証済みと報告しない。

## 回帰検査で見つけた不備の修正

初期実装のUTF-8 hex hash/await後のhash copyを棄却し、raw32byte SHA-256と入口での独立copyへ修正。追加の独立回帰で、prototype由来slotsの受理、promotionの別contextへの再束縛、終了状態のawait前snapshot、slice例外の露出を検出・修正した。Node Buffer.sliceのview共有もREDで再現し、実bytesをnew Uint8Arrayでcopyする。

終了flagはFIFO内で確定し、readの終端判定はawait後に動的再検査する。promotionはfrom/toを固定copyし、同じID/attempt/key/issued、proof目的/期限範囲、旧record期限と次revisionを照合する。canonicalな実intent期限の最終権限検査は既存DB promotion CASが担い、純暗号化部品へDB権限を追加しない。

現在の集中検査は56件/233assertion成功（native WebCrypto + UT MemoryRepository）。実SQL統合/全check/独立最終レビュー/正式PRは継続中。archiveのRED/GREEN履歴はtest-results/account-merge/envelope-archive-historyへ保存した。

## 最終ローカル検証

独立レビューの追加P2（継承されたingestNonceがJSON保存時に欠落する）もREDで再現し、own fieldの判定で拒否した。最終集中検査57件/234assertion、固定候補dc78b0bbの全check735件/4251assertion・account型検査が成功。`envelope-final-review.md`は現行source SHAでP0/P1/P2なし。

`envelope-own-nonce-standard.log`は標準統合全工程が成功。実2OIDC/既存private部品/locking108条件12競合/intent83条件9競合/runtime121条件5競合/leg40条件6競合/cleanup19条件4実adapter条件を照合した。05:19:58UTC receiptは46入力SHA一致・全snapshot復元・deadlock0、05:20:06UTCに専用container2個削除。これはnonce-specificな実OAuth/公開proof API/owner切替の完了ではない。

正式Draftレビュー・CI・merge・公開は未完で、必須CIの起動制限を回避しない。最終証跡はtest-results/account-merge/envelope-own-nonce-{source.json,check.log,standard.log,runtime.log}。
