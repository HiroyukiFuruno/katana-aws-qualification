# #58 署名済みSSO proofの受理（実装・検証中）

一次要件は[proof契約](20261121_account_merge_proof.md)、[データ契約](20261121_account_merge_data.md)、[SDK接続](20261121_account_merge_server_sdk.md)。当初PR93 head aaa6d324を基準に設計した。最新SDK回復修正はPR93 b5216cfで、native検証のsource treeは各証跡に個別記録する。設計マップと統合注意はtest-results/account-merge/signed-proof-next-slice-{review,root-notes}.md。

## 今回の範囲

- private schema部品とowner-only SQL helper、server-only proof worker、fixture専用のPostgREST wrapperを追加する。既存の公開migrationは変更しない。
- private部品の本番install用追加migration・本番RPC/Edge/role設定、owner/grant/fence/履歴移動、preview/commit、最終policy refreshは後続のまま残す。fixture wrapperを本番migrationへ混ぜない。
- 任意のUID/session/tokenをbrowserからproofとして受け取らず、公式SDKが暗号化保管したsessionだけをserverが復元する。main sessionは変更しない。

## schemaと状態

設計ゲートのP1五件（issuer正本、revision snapshot、target例外の限定、lock順、commit後nonce消去）は以下へ反映済み。レビュー記録は `test-results/account-merge/proof-accept-plan-review.md`。review中のissuer例ではなくcomposeの `API_EXTERNAL_URL=http://127.0.0.1:54530/auth/v1` と実GoTrue claimを照合して設定する。

- `proof-schema.sql`は既存target UID/account/epochの曖昧な組合せを拒否したまま、merge_existingで成立済みtarget proofのUIDだけがある状態を許す。add_existingや未証明状態へ一律に許可しない。証明後のcancel/expiryでもsnapshotを保持できること。
- account_proofsのleg/session global UNIQUEに加え、同intentの同Auth UIDを重複受理しない。所有単位はAuth UIDであり、氏名/メール/provider名による同一人物推定をしない。
- proofにはaccount_membership_revisionを追加し、account_id/membership_epochと全nullまたは全non-nullにする。membershipの物理keyであるauth_user_idは既存proof.auth_uidで保持し、存在しないmembership_idを推測追加しない。target受理時にも既存source proofのmembership/account revisionを再検査し、変化していれば再認証を要求する。
- sourceはactor UIDと一致、targetは別UIDで一回だけ固定。source/targetともactive membershipをDBから解決し、account/epoch snapshotを保存する。membershipが無い状態と、revoked/disabled/retiredの状態を混同しない。
- proof insertとlegのproved化、source→awaiting_target / target→both_provedは同一transactionにする。同じlegと同じsessionの再送は同じmetadataへ収束し、別session/別UID/別legへの再利用や期限延長をしない。

## JWTと権限境界

- HTTP正例は実GoTrue OAuth JWTをBearerにして実PostgRESTへ送る。UID/SIDは署名済みrequest.jwt.claims/auth.uidから導き、引数にUID/SID/account/epochを持たせない。service-roleが申告UIDを渡す近道は禁止する。
- PostgREST14.1のaudienceをauthenticatedへ固定する。helperは必須role/sub/session_id/exp/aud/issの型と値も検査し、issuerを信頼済みserver設定と照合する。HTTP入力/Hostを期待issuerの正本にしない。
- 同版のissuer非検査、exp/aud欠落・空aud配列・30秒skewを見逃さない。helperではDB時計でexpを厳密に検査する。PostgRESTとhelperの拒否を区別して記録する。
- 期待issuerの正本は新しいprivateのsingleton設定表account_protocol_settings（owner-only、RLS・API権限なし）に置くauth_issuerとする。fixture ownerが同一projectの固定URLを登録し、helperはその行だけを読む。browser/HTTP/header/GUC由来の期待値は採用せず、未設定・不正設定は拒否する。本番設定/追加migrationは公開前の後続gateに残す。
- wrapperはfixtureにのみ作成しauthenticatedのexecuteだけを付け、private schema/table/helperへのAPI roleの直接権限は増やさない。欠落したserver設定はfail closedにする。
- nonceはserver envelopeから得る32byte秘密値とDB hashを比較し、URL/log/監査へ出さない。main actor UID/SIDとintent/legの正規束縛も確認する。invalid secret/nonceで他人のattemptを消費しない。

## lockとfreshness

- 既存controlと同じactor advisory→intent→正規legの直列化を守り、Auth user集合はUUID順、session集合はUUID順NOWAIT、AMR、既存state、account/membershipの順に保護する。下位lock後に新しい上位lockを後取り・upgradeしない。
- main/proofのlive sessionを再検査し、proof session.created_atとDB OAuth AMR.updated_atをleg.issued_at以降に限定する。JWT秒精度だけでfreshnessを判断しない。DB AMRとJWT AMRも整合させる。
- target受理では保存済みsource proofのSID/live/OAuth/freshness/期限も再検査する。session lock集合はmain SID・今回proof SID・既存source proof SIDを上位lock前に確定し、UUID順NOWAITで保護する。membership snapshotだけの再検査で代用しない。
- 待機後に時刻/intent state/leg state/revision/phase/nonce/membership snapshotを再読する。cancel、expiry、membership/epoch変更、session失効が先なら所有やproofを変更しない。
- DB行検査をGoTrueの全timebox/inactivity/single-session policy検証と呼ばない。final refreshの上位要件は残す。

## server側の受理とnonce消去

- SDKのexchanged/proof contextを新しいstorage instanceで復元し、同一projectの公式getUser(explicit token)で確認する。refresh/code再交換は行わない。
- raw nonceと保存済みproof JWTだけを使ってfixture wrapperを呼ぶ。DB受理がcommitしてからenvelopeのnonceをCASで消す。SDK sessionと固定intent期限は維持する。
- DB受理後の応答喪失・nonce消去失敗でもproofを取り消さず、次の同じserver要求でmetadata/cleanupへ収束させる。nonceを先に消さない。同じproofを再作成・再消費しない。
- browserへはmetadataだけを返し、相手UID/owner/件数やtoken/nonce/verifierを返さない。

## 実行可能なDoD

### 実装レビューで追加した指摘（対応・実境界検証済み）

- [/] add_existingの未所属sourceも受理でき、targetはactive member必須とする。sourceの未所属と失効・無効化を区別する。
- [/] 上位lock前のmembership集合と下位lock後の集合・account/epoch/revision/statusを比較し、変化時は新たな上位lockを後取りせず再試行する。
- [/] 取得済みAuth UID集合以外のmembershipをlockしない。必要なら全UIDを最初に確定する。
- [/] state/account等の待機後にもmain/current/sourceのlive期限とOAuth/creation下限を再検査する。
- [/] stored source proofのOAuthとsource legの発行時刻の関係もtarget受理時に維持する。
- [/] nonce消去前にcanonical proof UID/SIDまで検査し、commit後応答喪失・消去失敗の再送をUTと実保存境界で確認する。

- [ ] private schemaの正常/異常target組合せ、同UID/同sessionの重複、既存制約/ACLを実DBで検査する。
- [ ] 公式SDK→実2 OIDC→GoTrue→PostgREST署名JWTでsource/target proofを受理し、fixtureの手動awaiting_target更新を廃止する。main UID/SIDと保存値は維持する。
- [ ] 少なくとも一つのfixtureでaccount IDとAuth UIDを異なる値にし、membershipからownerを解決したsnapshotを確認する。未所属target、inactive membership、source snapshot変更を別の入力にする。
- [ ] 実HTTPで通常のGoTrue JWT正例と署名破損/通常期限のaudience不一致を照合する。SQL-only固定GUC入力は別に数え、署名HTTPの正例と読み替えない。拒否済み実短期限JWT操作は再実行・言い換えで迂回しない。上位の未検査条件を成功扱いしない。
- [ ] nonce不一致、main/proofの別SID、OAuth/creationの下限、role/issuer/aud/expの欠落・型・値、cancel/expiry、再送、global session再利用を固定入力と実DBで照合する。拒否前後のpublic/private/Auth保護行hashを確認する。
- [ ] lock待機を実DBで観測してから再開し、cancel/session失効/membership変更/同leg二重受理でdeadlock0と意図外変異0を確認する。Mock HTTP/固定sleep/timeout延長は使わない。
- [ ] nonceが受理前に存在しcommit後にのみ消えること、失敗・再送後に同じproof/session/期限へ収束することをUTと実保存境界で確認する。UTのMockは許可する。
- [ ] 正常/失敗DTOをcanonical値へ厳密一致させ、実秘密値をstorage/console/request/公開応答へ漏らさず、callbackの即時query除去/第三者scriptとGA不在を検査する。
- [ ] 専用利用者/owner fixture/intent/runtime/wrapperをfinallyで後処理し、既存全表hashと許容audit差分を記録する。personal accountの統合・削除は行わない。
- [ ] source SHA、150行、型、重複、全check、標準integration、独立レビューを回収し、Draft→指摘対応→Ready→required CI→通常merge→公開を守る。CI支払い制限を迂回しない。

本スライスの完了をIssue58全体・本番SSO連携/owner移行の完了と読み替えない。既存full DoDの未検査・本番設定・移行は別の残作業として保持する。

## 2026-11-21 ローカル検証・公開方針の更新

- [x] ユーザー指示でActions復旧待ちをローカルの既存品質検査へ置換。UIの多言語修正はPR95で通常merge・本番公開・10言語実ブラウザー確認済み。
- [x] 固定future候補f5971a46でordinary JWTのexpを変えない4HTTP否定入力（署名/audience/issuer/nonce）が実GoTrue/PostgRESTで成功。
- [x] sourceのcancel/session/created_at/OAuth freshness競合を実DB待機で検証し、拒否後の通常acceptと全baseline復元が成功。
- [ ] response-lossはleg期限とproof期限の比較誤りを修正。intent期限一致と再送前後proofの同一性をnativeで再検査する。
- [ ] merge_existingのsource割当/target未割当、およびAuth DELETEとの行ロック競合のSDKケースを追加しnative検査する。
- [ ] 既存DoDのsource/target両モード、lower-lock後のepoch/freshness再検査、同SID/同UID再利用、cleanup等の残条件を実際の検証結果で埋める。

記録: test-results/account-merge/proof-rest-followup-source.json / proof-rest-followup-native.log。11 SDK cases中10成功・1失敗であり、proof component全完了や本番導入とは扱わない。

## 2026-11-21 固定20ケースの検証結果

- [x] 固定tree `2df0ee8089eb57286f0b72792a3a77bcc6286ddb`（archive SHA `2f2aaa130137216fc0ef0f8ff81f95d2883d1708c2c2d09714ca4c8104728787`）の標準account:integration exit0、SDK20ケース成功。通常JWTのexpは変更していない。
- [x] response-loss、merge_existingのsource割当/target未割当、Auth DELETE行ロック、source4/target5競合、parallel exact replay、nonce cleanupの実保存障害と同callback再送を検証した。
- [x] 45固定GUC入力と172foundationは別の検査群として数える。後段snapshot60/ACL7と6private harness/source integrity、保護行復元・専用fixture cleanupも回収する。
- [ ] PR93の後着metadata読取り障害修正b5216cfは20ケース候補に含まれていないため、同修正を含む最終公開候補のsource対応表・必要なnative再検査を回収する。
- [ ] 異intent/legへの同一実proof SID再利用の署名HTTP負テストを追加する。同leg再送とschema-only unique検査で代替しない。
- [ ] 最終source SHA・独立レビュー・Draft再レビュー・通常merge・公開確認は未完。20ケース成功をfull #58完了と読み替えない。

証跡: `test-results/account-merge/proof-nonce-native-{source.json,check.log,.log}`。
以前の11/19ケースの記録は当時の履歴であり、上記固定20ケースの結果が新しい。

## 2026-11-22 最新の21ケースと独立レビュー

固定候補 `a6d57d60671d63010fe7d172856a15a495d5b540`、archive SHA `6d227bd600a802c3c56bec667b37864e9eee7a61e1b0ccd658e6297c4981affe` で以下を回収した。以前の未成功記録は履歴であり、この固定候補の結果に置き換えて読む。

- [x] 最新PR93 b5216cfのworker/回帰も含む全check853件・両型検査が成功。標準account:integration exit0、SDK21件成功。
- [x] source/target両モード、inactive membership・source snapshot変更・session失効/creation/OAuth freshness/期限を実DB待機の別条件で照合した。
- [x] 異intent/legへの同じ実GoTrue proof SID再利用は、他の前提を有効にして実PostgRESTの409/23505/`account_proofs_session_id_key`で拒否。原proofを保持したまま通常source/target両proofが成立する。
- [x] 応答喪失・parallel exact replay・実保存nonce cleanup障害/同callback再送、canonical DTO・秘密非露出・通常JWT exp不変を検査。固定GUC45件とfoundation172件は署名HTTP21件と別集計。
- [x] 後段snapshot/ACL、6private harness、postconditions7、source integrity、全public/protected hash復元・専用fixture cleanupが成功。最初の21ケース失敗はtest画面復帰とfinally後処理の手順を修正して解消した。
- [x] `proof-session-final-review.md` で、以前の2件のP1検証不足の解消と新たなproof-only P1なしを独立確認。
- [ ] 静的解析の後着修正を含む最終source mapping/通常check、Draft正式レビュー・reply/resolve・Ready・通常merge・本番公開は別途完了させる。Docs進捗以外のnative入力codeが上記固定候補と一致することを照合する。

証跡: `test-results/account-merge/proof-session-v2-{source.json,gates.json,dod-evidence.md,check.log,native.log}`、`proof-session-final-review.md`。
本番owner切替・本番proof RPC/Edge/role・preview/commit・履歴merge等のfull #58は引き続き未完。
