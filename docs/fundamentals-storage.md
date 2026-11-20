# 基礎学習の保存・ゲスト移行契約

## 正本と所有境界

会員の正本は `fundamentals_unit_progress` と `fundamentals_final_sessions` であり、全RPCは
`require_learning_generation` で `auth.uid()` と世代を照合する。教材の正答・閾値・順序は
`published_fundamentals_catalogs` の公開済みversionだけから読む。clientの `passed`、`score`、
`correctChoiceIds`、順序は採用しない。revision競合は `PT412`、reset後の世代違いは `PT409` とする。

ゲストは同じcatalogを使うがブラウザ保存であり、member RPCへ直接書かない。移行は明示操作で
`begin_migration(..., 'fundamentals-progress-local-storage', 1, fingerprint, declaredRows)` を開始し、
各unitを `import_fundamentals_unit` で処理してから `complete_migration` する。通常のlesson stateは
専用保存を正本とし、legacy historyへの二重投影はしない。

通常のcheckpoint保存は `record_fundamentals_step(..., p_receipt_id, p_duration_ms default 0)`、final回答は
`save_fundamentals_final_response(..., p_receipt_id, p_duration_ms default 0, p_cursor_position default null)`
とする。durationは0から86400000までの整数で、receipt hashに含める。finalの`p_position`は固定question
index、`p_cursor_position`は表示中のresume cursorであり、cursorだけのnext/backは追加RPCを発行しない。
cursorを伴う保存は選択肢と同じackで保存する。finalizeは保存済みのresponse durationを使い、未回答だけ0とする。
`resumeStepId` は読解・checkpoint のplan stepだけを指す。`resumeStage` が `final` または `result` のときは
常に `null` とし、final sessionの再開位置はsessionの`position`だけから読む。

## schema 1 payload

`source_row_id` は `unitId + ':' + contentVersion` のUTF-8文字列で、manifest内で一意にする。
`payload` はcanonical JSONをUTF-8 SHA-256した `payloadHash` を伴う。未知fieldはrejectし、UUID、
array、文字列長、position、catalog versionをすべて検査する。catalogの`contentHash`はgeneratorがcanonical
artifactから作るSHA-256 hexをDBで`decode(hex, 'hex')`して保存する。PGの`jsonb::text`でcatalog hashを再計算しない。

```json
{
  "unitId": "cloud-practitioner-basics",
  "contentVersion": "2026-11-learning",
  "completedSlideIds": ["slide-1"],
  "completedCheckpointIds": ["check-1"],
  "furthestPlanPosition": 2,
  "resumeStage": "checkpoint",
  "resumeStepId": "check-1",
  "checkpointReceipts": [{"stepId": "check-1", "receiptId": "uuid", "questionRef": {"questionId": "...", "revision": 1, "sourceVersion": "..."}, "selected": ["choice"], "answeredAt": "ISO-8601", "durationMs": 1200}],
  "activeFinal": {
    "sessionId": "uuid",
    "startedAt": "ISO-8601",
    "position": 1,
    "questionOrder": [{"position": 0, "questionId": "...", "revision": 1, "sourceVersion": "..."}],
    "responses": {"0": {"questionRef": {"questionId": "...", "revision": 1, "sourceVersion": "..."}, "selected": ["choice"], "selectedAt": "ISO-8601", "durationMs": 1200}}
  },
  "submittedFinals": [{"sessionId": "uuid", "startedAt": "ISO-8601", "questionOrder": [], "responses": {}, "submittedAt": "ISO-8601", "eventIds": ["uuid"]}]
}
```

checkpoint receiptはcatalogに照合して、同じ`receiptId`をevent IDに一度だけ使う正当なstudy履歴としてDBへ
書く。lesson state以外のlegacy local historyを別途移行しないため二重投影は起きない。`submittedFinals`には
score/passedなどのderived fieldを許可しない。各finalのquestion orderは
`{position, questionId, revision, sourceVersion}`を12件すべて含め、DBはcatalogと厳密に照合してから
catalog側の完全な問題snapshotを保存する。clientのstem、choice、正答、score、passedは受理しない。DBが
server scoreと `ceil(questionCount * 0.8)` を再計算してsubmitted sessionを作る。
未回答は空配列、必要数未満の選択は部分選択として不正解となる。いずれもcatalog内の選択肢だけを
含み、必要数を超える選択はrejectする。finalの学習eventは新規sessionごとに提出時一度だけ書く。

## RPCの原子性と競合

`import_fundamentals_unit(p_expected_generation, p_manifest_id, p_source_row_id, p_payload)` は
manifestをlockし、同じrow/hashの成功をsnapshotとして返す。同一rowの異なるhash、同じsession UUIDの
異なるtrusted内容は `23505` で拒否する。catalogなし・不正選択・不正順序は `22023` とし、何も書かない。

既存memberのcompleted IDはunionし、furthest positionを下げず、submitted sessionは同UUID・同一内容だけを
受け入れる。memberとguestが別々のactive finalを持つ場合は `PT412` でsource全体を保持する。自動破棄・
上書き・scoreの採用はしない。利用者が会員側finalを完了またはresetした後、同じmanifest rowを再試行する。
このため、import前にprogress/session/itemを同一transactionでlockし、accepted itemはpayload hashを保存する。

catalogのold contentVersionは保持する。catalog rowはappend-onlyであり、client・通常authenticated roleに
UPDATE/DELETE権限はない。resetは当該ownerのunit progressとfinal sessions（およびcascadeしたfinal events）を
消してgenerationを一度だけ進め、catalogと他ownerを残す。account deletionはFK cascadeで同じownerの行だけを消す。

## codec / 実装前の確認

codecはcanonical JSONのfield順、UTC timestamp表現、SHA-256入力を固定し、`contentVersion` は80文字以下にする。
RPC自身がcanonicalized payloadからhashを計算し、clientのhash値を受け取らない。
codec実装はこのRPCと同じcatalog snapshotを使い、payload中のfinal question refを増補・推測しない。
sessionの`questionOrder`がcatalogと完全一致しない場合はimportしない。finalの`eventIds`はquestion orderと同数・
位置対応のstable UUIDであり、同UUIDの異payloadは拒否する。active final conflict UIは、会員側を完了するか
pending guest sourceを明示discardするまで再試行可能に保つ。

guest importはsourceのfinite UTC `startedAt` / `selectedAt` / `answeredAt` / `submittedAt` と有効なdurationを
保持する。欠損timestampをserver時刻で捏造せず、source内で比較・検証できる情報だけを採用する。通常の
オンラインRPCはserver receipt時刻を`answered_at`に使うが、明示移行したreceiptはsourceの`answeredAt`を保持する。

## 単元間の保存待ちと移行再試行

会員outboxの読込時再送はunitId/contentVersion単位とし、別単元のPT412が現在の単元を止めない。
目次の集計はDBで確認済みの記録を読み、未送信commandのある単元には保存待ちの案内を表示する。
利用者が該当単元を開くと同じcommandを再送し、競合時は保存済みの記録を明示的に読み直す。
別単元を開いたことを理由に、競合commandや原本を破棄しない。

ゲスト移行はclientのcodecだけでなくDBもtrusted catalogの連続した必須STEP完了と位置、
途中チェックのreceipt、final開始前提を検証する。途中チェックの再挑戦は別receiptとして保持する。
complete_migration後の通信・再読込・端末削除失敗でも、同じmanifest/row/hashのaccepted receiptを
再検証して削除手順を再開できる。完了済みmanifestへ新しいrowや別payloadを追加しない。
