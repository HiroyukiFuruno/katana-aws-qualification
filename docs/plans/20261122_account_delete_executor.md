# #58 全体退会の固定job実行部

## 目的と境界

両側SSO統合後の退会では、事前の明示同意・全membership fence・内容消去をDB transactionで確定してから、固定したAuth UID集合だけを公式Admin APIで削除する。別紙logical-delete-cutover-design-v1.mdの固定job契約を実装する。

今回の実行部はbody/UID/receipt selectorを引数に受けず、server-only repositoryから既承認・fence済みdue jobをclaimする。次の対象は同じleaseをDBで再検証して受け取る。Auth DELETEの成否だけでは完了にせず、公式GETのuser-not-foundを確認してからCASで保存する。最後のanchorは全non-anchor確認後だけ処理し、全404とDB finish確認後だけcompletedとなる。部分失敗・lease喪失はpendingを返す。

## 未接続と完了条件

- [x] executorと単体failure/lease/order/再試行のRED→GREEN。Mockは単体のみ。
- [x] 公式AuthAdminApi adapter（service credentialはmemoryのみ）、未知404/別UIDを単体で拒否。実HTTP検証は未実施。
- [ ] private job schema/claim/next/confirm/defer/complete RPCを全同意・scope固定・CAS・privacy契約付きで接続する。
- [ ] 全12表/原本/lineage消去とfreshactor開始を同一TXで検証する。
- [ ] 実GoTrue2UID・部分失敗(row lock)・再試行・anchor最後・全404・識別情報消去をnative検証する。
- [ ] public owner cutover/全言語UI/clientの204/202/再試行を同時公開する。

今回のsource-only部品は現single-UID delete endpointの挙動を変更せず、全体退会完了とは扱わない。

実装根拠: Supabase公式Auth error codes https://supabase.com/docs/guides/auth/debugging/error-codes とGoTrue v2.198.0 errors.go https://github.com/supabase/auth/blob/v2.198.0/internal/api/errors.go 。SDKはX-Supabase-Api-Version 2024-01-01を設定しtyped codeを返す。HTTP404やメッセージ一致だけで削除完了とは判定しない。新Admin adapterは公式AuthAdminApiを利用し、現handlerは未変更。
