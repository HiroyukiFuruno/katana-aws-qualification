# #58 terminal runtimeのcleanup専用revision読取（ローカル検証済み・未公開）

一次要件は[暗号化部品](20261121_account_merge_runtime.md)と[runtime DB](20261121_account_merge_runtime_db.md)。DBの通常readはterminal/期限切れを非表示にする一方、現在のSDK storageのterminateはreadからrevisionを得る。両者をそのまま接続すると既存blobを「不在」と扱ってnull revisionで削除を試み、conflictになり得る。通常readを緩めず、cleanup専用の最小metadata経路を設ける。

## 対象と完了条件

- [ ] owner-onlyの`runtime_cleanup_revision(leg_id, guard)`を新規private SQLへ追加する。intent→leg→runtime順でlockし、正規phase/context/固定expiryを照合してrevisionだけを返す。
- [ ] terminal/期限を理由にrevisionを隠さず、ciphertext/nonce/tokenは返さない。未知ID・異なるphase/guardはnullか固定された拒否でfail-closedにする。
- [ ] `RuntimeRepository.readRevisionForCleanup(legId, guard)`を必須として、terminateはこれを使ってから既存のguard付きdeleteIfRevisionを呼ぶ。read/getItemの拒否条件、FIFO、鍵不要cleanup、CASは維持する。
- [ ] 全API roleのEXECUTEを閉じ、公開wrapper/schema/grant・Edge adapter・owner処理は追加しない。
- [ ] 実DBで既存のread→null/delete→conflictをREDとして回収し、新経路で取消し後/期限切れ後に削除でき、active同phaseやproofへの置換を古いrevision/contextで削除しないことをGREENで照合する。
- [ ] SDK storageと実DBのowner-only test adapterで実暗号文を保存→intent終了→terminateまで接続する。ITにMemoryRepositoryやネットワークMockを使わず、実Postgresを呼ぶ。fixture専用の暗号鍵はそのプロセス内だけで生成する。
- [ ] 前後snapshot・全入力SHA・owned cleanup・ログ非露出を回収する。固定sleep/timeout延長/実短命JWTケースは使わない。
- [ ] 関連単体・標準runner・型/構造/全check・独立レビュー・Draft→指摘対応→Ready→必須CI→merge→公開を回収する。

これはprivate内部interfaceの補強であり、実Edgeの接続やproof/mergeの完成ではない。SQLのreadをterminal後も返すように変更したり、null revisionを任意版削除のwildcardへ変更したりして検査を通さない。

## ローカル検証の回収

`test-results/account-merge/cleanup-final-standard.log`は標準統合全工程で成功。新規SQL19条件と実Postgres adapter/実WebCryptoの取消し・期限切れ・stale revision・旧contextの4条件を照合した。保存後は鍵取得を例外に切り替え、cleanup時の取得回数が増えないことを検査した。旧経路のread=null/delete=conflictも実DBで再現記録を残した。

最終receiptは04:36:07UTC。41入力SHA一致、auth/public/private全rowの件数とhash復元、deadlock0、専用container2個削除を確認。GoTrueはfixture起動の確認だけであり、本単位で公式OAuth交換を検証したとは扱わない。固定候補965d5249は全check699件/4112assertionとaccount型検査が成功。正式レビュー/CI/公開は未完。
