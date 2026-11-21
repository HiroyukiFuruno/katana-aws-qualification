# #58 公式SDKとprivate runtimeの接続

一次要件: [proof](20261121_account_merge_proof.md)、[envelope](20261121_account_merge_envelope.md)、[exchange control](20261121_account_merge_exchange_control.md)。固定auth-js 2.119.2の読取記録はtest-results/account-merge/server-sdk-next-slice-review.md。

## 対象と権限境界

- 新しいOAuth/PKCE実装を作らず、公式AuthClientにEncryptedPkceStorageを渡す、platform-neutralな内部workerを追加する。
- 入力context/intent期限/nonce hashは、検証済みmain actor/session/intent secretに束縛されたserver-only control/repository portから得る。browserが指定したUID/hash/任意JWTを所有証明にしない。
- 新legのnonceはserverがraw32byteで作成してhashだけを既存metadataへ渡す。workerへ渡るraw nonceもserver内部だけ。callbackでは保存済みenvelopeから復元する。
- この単位ではproductionの公開Edge/RPC/role/secret登録、署名proof受理、owner/grant/履歴統合を追加しない。実fixtureのHTTP adapterも本番の権限境界の完成とは扱わない。
- 今回の注入portは機械的なSQL代替ではなく、既存owner-only操作と固定guardを呼ぶための境界とする。最終proof UIDは後続のPostgREST署名JWTから導く契約を維持する。

## 認可開始

1. canonical leg contextでenvelopeを初期化し、nonce/hashの復元を確認する。永続化前にSDKや認可URLを開始しない。
2. authorization claimを得た一回だけSDKを開始する。replay/recoveryではSDKを呼ばず、既存statusと明示restart要求を返す。
3. 公式AuthClientをpersistSession=true、flowType=pkce、autoRefreshToken=false、detectSessionInUrl=false、debug=false、専用storageKeyで作る。認可開始と保存sessionのない初回交換ではinitializeの結果も回収する。保存済みsessionの復元はSDKの暗黙refreshを避けるため、暗号化storageを厳密に読み、公式getUser(explicitAccessToken)で検証する。復元でinitialize/getSessionは使わない。
4. provider/callback/scopesはserver設定の許可リストに固定する。任意token endpoint/redirect/queryParamsをbrowser入力から渡さない。公式signInWithOAuth(skipBrowserRedirect=true)を使う。
5. SDKのverifier書込が成功したruntime revisionをcomplete authorizationへ渡す。active/preparedが確定した場合だけURLを返す。URL喪失時に新しいPKCEを自動再発行しない。

## code交換と保存結果の復元

- 最初の交換はnonce/hashの復元後にexchange claimを取得し、DB transactionを終えてから公式exchangeCodeForSession(code)を呼ぶ。OAuth待ち中はDB lockを保持しない。
- 既処理statusを先に扱い、同じleg/codeをSDKで再交換しない。exchangingに保存済みsessionがあれば、その同一sessionだけを再検証してpromotionを再開する。保存結果がなければin-progressを返し、勝手にもう一度codeを使わない。
- SDKが返したsessionはgetUser等の同一project検証を通し、保存sessionのuser.idとも一致させる。sourceはtrusted canonical legのexpected_uid（main actor）との一致もpromotion前に要求し、不一致はknown failureとして保存結果をproofへ昇格しない。browser申告UIDで代用しない。token/verifier/nonce/provider tokenをpublic DTOへ含めず、生SDK例外/message/causeを外へ返さない。
- この段階でrefresh_tokenによる通信は許可しない。固定SDKのgetSessionはautoRefreshToken=falseでも期限付近でrefreshするため、単にこのoptionだけへ依存しない。SDKの通信境界でもrefreshを遮断し、期限付近の保存sessionを別sessionへ更新して復元したことにしない。短期限の実JWT操作は再実行せず、この境界はUTで検査する。
- session保存と外部交換は原子的ではない。通信/保存失敗で結果不明ならexchange_unknownとして新legの明示認証へ進める。保存済み結果がある場合は先に復元し、存在するreceiptを誤って捨てない。
- claimを取れなかった並行workerがreceipt不在だけでexchange_unknownへ変更してはならない。進行中はstatusを返し、本人による既存replace操作は新legで旧legをsupersededにする。停止したworkerも同じcodeを再交換せず、旧workerの遅い保存はstate/CASで拒否する。新しいleaseや自動交換再試行は追加しない。
- envelope全体を新しいproof context/正規intent期限で再暗号化し、既存runtime promotion CASで確定する。leg instanceのcontextを書き換えず、proof読取には別instanceを生成する。
- proof sessionを読む内部手段はserver限定。公開戻り値はleg ID/state/expiry/必要なURLだけで、proof UIDやtokenの返却はしない。nonce消去とproved化は後続の署名proof受理後であり、この単位で先取りしない。

## 実行可能な検証

- [x] native SDKを使い、provider/callback拒否、nonce永続化前の開始0、claim replay時のSDK開始0、verifier保存後だけのURL返却、固定error非露出をUTで検査する。MemoryRepository/fetch fakeはUTだけに限定する。
- [x] SDK/keyring/storage/claim/complete/verify/promotionの失敗と、途中cancel/expiry/応答喪失を検査する。既存receiptからの復元は同sessionだけで、code交換回数が増えないことを確認する。
- [x] 実GoTrue/2種OIDC/Postgresで、main Aを保持したままserver PKCEでfresh A/Bを別legに認証する。新workerによるverifier/session復元、正規proof AAD/固定TTL/provider token除去を照合する。HTTP Mock/固定sleep/operation timeout延長は使わない。
- [x] browserのmain UID/SID/token保存値とkeyがproof中も変わらず、kaq-proof key/nonce/verifier/proof tokenがbrowser storage/API/console/query/GAへ現れないことを検査する。標準OAuth code queryは受信直後に除去し、fixture callbackにthird-party scriptを載せない。
- [x] native検査は専用の新しいsynthetic OIDC利用者を使い、親smokeの既存Auth利用者を削除しない。新規Auth/intent/runtimeの削除と既存public/private保護行のhash不変を照合し、GoTrueが正当に作るaudit差分だけを明示して検査する。owned servicesはfinallyで除去する。
- [x] source SHA/型/150行/重複/全check/標準runner/独立レビューを回収する。拒否済みshort JWT操作は再実行しない。
- [ ] Draft→指摘対応→Ready→必須CI→通常merge→公開を回収する。

学習accountの作成・切替は行わず、server SDKのexchanged状態をもってSSO連携やIssue58全体を完了扱いにしない。

## 検証結果と公開待ち

公式SDKの26 UT・128 assertionと、実2 OIDCを含む標準統合全工程が成功。新workerで同じmain UID/SIDのままsource/targetの別fresh sessionを復元し、provider tokenを受け取った2応答から保存前に除去した。既存publicとauth/private全36表のhashが復元し、追加auditは専用2 UIDの6行だけ。

検査記録はtest-results/account-merge/server-sdk-{final-focused.log,parent-standard-protected.log,core-final-review.md,fixture-final-review.md}。CIの支払い/利用上限制限は解除されておらず、公開とIssue58全体の完了は未達。
