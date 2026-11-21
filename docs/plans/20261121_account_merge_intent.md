# #58 連携intentの開始・参照・取消し

一次要件は[proof契約](20261121_account_merge_proof.md)と[統合計画](20261120_account_merge.md)。この単位は未登録private SQL・実DB検査であり、公開APIや統合処理全体ではない。

## 対応範囲

- [x] actor単位advisory→intent→Authの順で制御し、待機後のJWT/session生存を再検査する。
- [x] 256bit secretを一回だけ返し、DBにはhashだけ保存する。同一キーの再送からsecretを復元しない。
- [x] actor UID/session/secretを照合し、誤提示・未知ID・別sessionは同じ404とする。
- [x] active intentを一件に制限し、同じsessionによる明示的な置き換えと15分5件の開始制限を実装する。
- [x] 10分の固定期限、取消しversion、terminalの不変性と既存receipt返却を維持する。
- [x] 実GoTrueの3ユーザー/4sessionとPostgresで83 SQL条件・通常9競合シナリオを検査する。
- [ ] 標準runner全体、全check、最終独立レビュー、Draft→レビュー指摘対応→Ready→必須CI→merge→公開を回収する。

通常9シナリオは同じキー/別キーの並行開始、並行取消し、取消し後の再開始、intent待機中の期限切れ、advisory待機中のclaim/session失効、並行rate制限、commit済み状態と取消しの競合を含む。最後のケースはテスト専用SQLでterminalとreceiptを作る制御検査で、実際のmerge完成ではない。

## 検証境界と記録

`test-results/account-merge/intent-harness-first-green/`は83 SQL条件・通常9シナリオの成功、deadlock 0、nonceのログ非露出、開始/終了時の全fixtureデータ一致と専用コンテナ2件の削除を記録している。処理失敗もsubtransaction内の構造化JSONとして回収し、stderrと完了markerの競争を避ける。ITをMockへ置き換えていない。

`intent-control-expiry-green-real.json`にはAuth行lock待機中の実短命JWT失効3ケースの既存GREENと入力SHAがある。新しい通常runnerでこの3ケースを再実行したとは報告しない。

親の追加検査で、全migration/関連helper/SQL条件/ハーネスの入力SHAを固定し、実行後の一致も確認する。期限切れの再参照ではstate/version/期限が全て変わらないことと、9シナリオの名前集合一致を検査する。秘密を含むJSONは失敗/cleanup経路も探索・秘匿してから書き出す。

外部公開wrapper、body限定transport、PKCE leg/proof、秘密blobの後片付け、preview/commit、owner/FK/RLS切替は未実装として残す。全roleへのprivateアクセス禁止を維持し、この単位だけでIssue #58をCloseしない。

`intent-harness-standard.log`: 標準`account:integration`全体がexit 0。実2issuer OIDC、foundation 172、session 71、read scope 148、bootstrap 31、snapshot 60、ACL 7を通過した後、lockingの108条件/実12競合とintentの83条件/実9競合を順に成功した。Python単体はlocking 7件＋intent 3件。両ハーネスとも専用コンテナを削除し、intentの終了snapshotは開始時と一致した。入力SHA一覧は`integration/intent-harness/actual-results.json`に記録した。`intent-harness-typecheck.log`も成功。全check・レビュー・CI・公開の回収は継続する。

`intent-final-collected-review.md`: 最終独立レビューで32入力SHAの一致、不一致0、83条件/9シナリオ・snapshot復元・cleanupを照合し、private制御/ハーネス範囲の残存P0/P1/P2なしを確認。旧first-greenだけでは追加検査を裏付けられないという証跡不足は、新しい標準runnerの完了receiptで解消した。

`intent-candidate-check.log`: 固定候補tree `7da7e178915479acdb81931d76ed4e70fedc8419`で標準check全体（695件・4,094検証、辞書/直書き/重複/型/教材/構造/build）と追加の`account:typecheck`を成功確認。archive/lockfile SHAは`intent-candidate-source.json`に保存した。
