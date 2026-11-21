# #58 データ保持・cutover契約（実装前）

基準main: f5afb97667024a7768e8320c94a2414942283f66 / 既存13migration / 12owner tables / 18教材版。
これは実装方針であり、移行・統合・公開の成功記録ではない。実利用者の統合・削除は行わない。

## 段階と所有境界

1. 非公開のaccount/membership/intent/proof/receipt/archive基盤を追加する段階では、既存12表のFK/RLS/RPCを切り替えず、利用者の保存先も変更しない。
2. cutoverは全owner FK/RLS/RPC、bootstrap、ブラウザーowner/queue、退会を揃えた別の追加migrationとアプリ変更で実施する。既存13migrationは改変しない。
3. cutover時点までに作られた既存Auth UIDは従来KAQの1:1accountとしてbackfillする。全12表のowner集合とauth.usersを照合し、settingsのみのownerも対象にする。既存UUIDとgenerationを維持する。
4. cutover後の新Auth UIDには学習accountを自動作成しない。bootstrapは自分のmembership有無・再認証要否だけを返す。本人が新規を選択するか、既存accountへの追加を完了するまで学習state/queue送信/importを開始しない。
5. Auth UIDとlogical account IDは別fieldとする。既存の列名user_idは学習account IDの意味で保持し、全Auth直親FKをaccount親へ切り替える。Authユーザー1件の削除で共有学習データを消さない。

## API binding・session fence

- 実アプリの全RESTページ/RPCはx-kaq-account-idとx-kaq-membership-epochを固定送信する。サーバーは署名検証されたsub/session_idから取得したmembershipと両方を比較する。header単独で権限を認めない。
- header欠落の旧クライアントは、未統合かつaccount ID = Auth UID / epoch0の既存1:1だけ許可する。片方欠落・不正UUID/整数・退会/統合履歴があるaccountでは拒否する。
- mergeでsourceだけでなくtargetの全membership epochも進める。merge以前の通常sessionは新scopeを取得できず、refresh後の新iatでも拒否する。承認済みproof sessionと、commit以後に開始した新OAuth sessionだけを許可する。
- bootstrapも同じfenceを通す。旧sessionに最新bindingを自動交付してはいけない。退会/切離しのtombstoneは新規化しない。
- generationは学習resetの世代、membership epochは所有境界、ProgressOwner.generationはブラウザーstore遷移世代として区別する。PT409のreset回復へmembership失効を混ぜない。
- SQLのread用resolverはSTABLE/読取専用とし、直接SELECTのRLSと公開read/RPCを同じ境界へ揃える。private helperをauthenticatedから任意UIDで呼べるようにしない。

## 同時実行・preview

- 全writerは対象accountの全membershipからAuth UID集合を発見し、Auth userをUUID順SHARE、対象sessionをUUID順SHARE、その後に既存require_learning_generation相当のlearning_state行SHAREを取得する。lock後の最新snapshotでUID集合/revision、membership/binding/sessionを再検証し、待機中にmergeされた旧呼出しを通さない。resetはstate UPDATEを最初から選び、SHAREからupgradeしない。
- mergeも全対象Auth user→対象session→両learning_state UUID順UPDATE→account/membershipの同じ順でlockする。初期発見と下位lock後のUID集合/revisionが違えば全rollbackし、追加UIDを後取りしない。Auth DELETE cascadeとmembership先行user後取りの逆順で実40P01を再現したため、その旧案を採用しない。全membership付替え・切離し・KAQ退会も参加し、retired ownerのstateは再作成しない。最小Auth DELETE比較実験を全writer検証完了とは扱わない。
- 完全preview digestは全12表の全列と件数を安定順序でSHA256化する。row SHA256の順序付き集合をさらにSHA256化し、UUID/時刻/回答/revision/hashを除外しない。tableを一つでも落とした部分digestを使わない。
- previewの表示件数・競合値・選択肢・digestは、両state UPDATE lock取得後の同一DB snapshotを一回だけmaterializeした値から生成する。別SELECT/別HTTPで得た件数を同じpreviewへ混ぜない。commitも同じlock下のsnapshotへ完全一致を要求する。
- 12表は保護集合の最低限であり、追加する模試resume choice・manifest replay-head・出自/ID対応等の全merge対象補助状態とrevisionも同じsnapshot/digestへ含める。後続#59/#60の設定・予定が加わる際も保護集合と保持/削除/検証を同時に拡張する。
- final consentはintent/両proofのlive性・TTL・membership epoch・preview digest・競合選択をlock下で再照合する。append/save/import/settings/resetのいずれかが変われば再previewする。merge途中の例外は全rollback、二重commitは同じreceiptを返す。
- account revisionを使う場合、全writerから更新し、state/account lock逆順やSHARE→UPDATE upgradeのdeadlockを作らない。完全digestが正本なので、部分的なrevisionだけで変更なしと判断しない。
- cutover後はactive accountごとにstateが必ず1行存在する制約を設ける。backfill/new-accountは同一transactionでaccount/state/membershipを作り、state不在は自動修復せずエラーにする。initialize/resetもAuth user/session先行で既存stateをSHARE/UPDATE lockしてbindingを最新再検査する。membership解除・全退会もこの順であり、account先行やmembershipからAuth userを後取りする旧案を採用しない。

## 全データの保持

| 種別 | 正本へ採用する規則 | 原本・競合 |
| --- | --- | --- |
| learning_events | 両側を保持。同ID同payloadの再送、または同guest source/fingerprint/rowと同内容で実証できる重複だけを除く。 | 同ID異内容はsource側へ新IDを割当てて両保持。類似設問・時刻一致ではまとめない。 |
| exam_sessions / responses | 受験ID・問題順・開始/締切・回答・提出状態・revisionを受験単位で保持。既存exam IDは全体PKなのでDB内衝突はない。 | 両draftを保持。次に再開する受験は本人が選ぶ。他方を提出済みへ偽装・破棄しない。 |
| earned_certifications | 安定certification IDで和集合。採用recorded_atは早い方。 | 両原本と日時はarchiveへ残し、previewで日時規則を示す。 |
| assessment_answers / roadmap_profiles | 同answerは収束。異answerは設問ごとの本人選択。profile revisionは双方旧値より大きい新revision。 | 全旧値/日時/revisionと選択を保存。 |
| dashboard_settings | 両側が異なればどちらかの設定全体を本人が選ぶ。widget/filter/timezoneを無断で混ぜない。 | 新revisionを発行し、両原本をarchiveへ保持。resetで残す既存境界を維持。 |
| fundamentals_unit_progress | 同unit/contentVersion内で完了slide/checkpointを和集合し、catalog順の連続到達を再検証する。合格は実提出sessionだけから導く。 | 再開位置とactive finalが異なれば本人選択。旧版合格を新版へ移さない。 |
| fundamentals_final_sessions | 両側の全提出回・draftを保持。別の受験を混合しない。 | draft1件uniqueを「現在選択中のdraft1件」へ置き換え、未選択draftも取得・明示再開できる。通常save/finalizeは選択済みactiveだけ許可。 |
| migration_manifests / items | source_name/fingerprintで出典を対応付け、row/outcome/payloadまで比較。同一sourceの異内容は重複としない。 | 複数manifest/相反outcome/途中状態の原本とcanonical対応を保持し、import replayを新IDの重複作成にしない。 |
| learning_state | canonical側のgenerationを維持し、全membershipは同じ値を参照。 | sourceのgenerationと全元scopeはreceiptに記録。旧queueへcanonical generationを付け直さない。 |

## ID・hash・archive

- merge前に全12表の原本rowと出典を非公開archiveへ保存し、canonical ID対応表を別に残す。認証token・verifier・nonce本体はデータarchiveへ入れない。
- canonical IDの変更がpayload内sessionId、event ID、FK、receipt/hashに影響する箇所をすべて対応付ける。元payload hashとcanonical hashを区別し、列だけ変えて旧hashを新payloadの証明として使わない。
- 通常importの再送はcanonical manifest/item対応から解決する。元ID/hashによる再送を別の新記録として取り込まない。原文を推定復元できない既存hashは「元の受理payload hash」として保持し、元のhashを改竄しない。
- canonical正本/出自/参照を検証した後だけmembershipを切り替える。receiptにはbefore/after件数・hash・明示選択・除いた実証済み重複の理由を記録する。
- private archive/ID対応はresetで学習内容を復活させる保管庫にしない。学習resetでは内容を消し、非内容の操作receiptだけを残す。KAQ全体退会では全内容と識別可能な原本・対応を削除する。

## importの同一source衝突

- 同source/fingerprintのmanifestを無理に一行へ潰さない。各manifest IDと全item/形状/状態をそのまま保持し、既存のsource/fingerprint uniqueを「replay headに選択された一件だけunique」へ置き換える。再送対象headと原本variantを区別する。既存ID自体は全体PKで重複しない。
- shape/item/outcome/statusが完全同値のvariantはcanonical ID対応を記録して収束できる。異なるshape、同rowのaccepted/rejected差・異payload・started/completed/failed差はpreviewでsource単位の競合として示し、今後の再送に使うheadを本人が選択する。他方の受理済み履歴・manifest/itemは保持する。
- head選択で宣言件数やcompletedを合成・捏造しない。選択したmanifestのdeclared_rows/status/completed_atとitem集合を保持し、completeは従来の全件数一致を要求する。非head variantは凍結し、通常import RPCの追記対象にしない。
- begin_migrationは明示headだけを返す。新要求とheadのschema/declared_rowsが違えば固定競合を返し、別manifestへ黙って再取込しない。既存のsource重複uniqueを使ったON CONFLICTや複数行からの任意選択を残さない。
- completed headの再送照合はmanifest/source_row_idとcanonical ID対応から実際に受理したevent/sessionを引き、元のpayloadと照合する。元IDを新規受理し直さない。照合できない時はlocal原文を保持して明示復旧へ案内する。

## 保持したdraftの選択

- fundamentals finalへis_activeを加え、uniqueは(user,unit,version)かつstate=draft AND is_activeだけへ限定する。未選択draftはstate=draftのままis_active=falseで全回答を保持する。snapshotは未選択draftも返す。
- select_fundamentals_draft(session_id, expected_unit_revision, expected_session_revision, expected_generation)はstate SHARE/binding再検査→unit progress UPDATE→対象sessionをID順UPDATEの順でlockする。現在activeをinactiveにし、選択先をactiveにし、progressのactive/resume/revisionを同一transactionで更新する。古い選択はPT412、別owner/別unit/version/提出済みは拒否する。
- start/save/finalize/importもunit progress→sessionの同じ順に統一する。save/finalizeは対象がprogress.active_final_session_idかつis_activeであることをlock後に再検査し、非選択draftへの遅延書込を拒否する。選択で開始時刻・回答・受験revisionを巻き戻さない。
- 模試は両draftを現行schemaのまま保持し、resume choiceを別正本で管理する。選択APIはaccount/state→resume choice→exam session ID順にlockし、対象revision/CASを確認する。未選択draftは読取と明示選択を許可し、自動findLastで別受験へ遷移しない。

## 未同期と復旧

- この端末で確認できるpendingはmerge前の元scopeで同期可否を確認する。previewのDB件数と別端末の未送信件数を混同しない。
- 古いqueueはAuth UIDだけでなく元account/epoch/generationに束縛して原文を隔離・通知する。mergeや再認証に伴うdispose(true)/outbox.clearで破棄しない。新ownerへ自動flushしない。
- 本人が明示的に照合する復旧導線では、元scope/receiptと現在正本を照合し、未受理と確認できる記録だけを現在の所有証明の下で採用する。元原文は確認成功前に消さない。
- 既存v1 queueの互換取込はサーバー確認済みの未統合1:1/epoch0だけ。統合履歴があるaccountへ暗黙昇格させない。
- 成功後undoはtransaction rollbackではない。後続の別操作として新しい両側所有確認と再previewを必要とし、実装していないundoを広告しない。

## 退会とログイン方法

- KAQ全体退会、あるAuth membershipの切離し、同一Auth UID内の公式identity unlinkを区別する。mergeではAuth identityを移動・削除しない。
- 全退会はserver receiptを作り全membershipを先にfenceし、全内容を削除して全対象Authユーザーを公式Admin APIで削除・404確認する。複数削除の一部失敗を204とせず、短命のserver capabilityによる冪等再試行で完了させる。
- 最後の利用可能ログインを失わない判定はKAQ全体のmembershipと実identityをaccount lock下で行う。唯一identityのAuthユーザーをKAQから切り離す操作はidentity削除とは呼ばない。
- 実利用者の削除・統合はこの実装検証へ使わない。合成ユーザーの実GoTrue/OIDC/DBで全保持・fence・replay・同時実行・退会を検証する。
