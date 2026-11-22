# #58 merge conflict projection core（private source slice）

## 目的と境界

SQL `capture_learning_snapshot` が返す全12 public owner table の既存documentとSQL digestを受け、
private previewで表示する競合・保持・必要選択の**純粋な計画**だけを作る。DB、membership、Auth、session、
RLS、RPC、UI、canonical row、archive、ID remapを書き換えない。digestはSQL正本の文字列をそのまま入力へ
束縛し、JSのJSON stringify/hashで代用しない。

入力は異なる二つのactive account ID、各SQL snapshot document、各SQL digest、任意のversioned auxiliary
choice inputである。SQL document内の既知5 private tableはdigest境界としてのみ許可し、projection対象はpublic
12 tableだけに固定する。public tableの不足、未知table、未知/不足raw column、重複logical identity、owner
binding不正、同一account、不正な補助choiceはfail-closedで例外にする。

## 出力契約

- 全入力rowは `retained` または実証済み同値の `duplicates` のどちらかへ一度だけ出す。rowのraw columns、
  owner、primary identity、source/target provenanceを落とさない。
- `conflicts` と `requiredSelections` はprovisionalであり、選択してもcanonical writeや履歴の再構築をしない。
- `sqlDigests` は入力SQL digestの値をそのまま保持する。JS hashは作らない。
- 未schemaのexam resumeとmanifest replay headは `auxiliary.version = 1` の明示入力として表す。入力がない場合は
  候補を出すだけで、暗黙選択しない。
- auxiliaryのunknown fieldと既raw exam/manifestへ結合できないIDは拒否する。検証済み入力はplanへ保存するが
  `auxiliaryConnected = false` のままで、このsliceは選択やwriteへ接続しない。
- used row fieldsはunknown境界でUUID/zero UUID、有限number、enum、UTC時刻、JSON shapeを検査する。全rowを
  信頼済DB由来として型検査なしに扱わない。

## table規則

- `learning_events`: 同IDかつowner以外の全raw column同値だけduplicate。同ID異payloadは両rowを保持し、
  remapが必要な競合にする。
- `exam_sessions` / `exam_responses`: 両draft/回答を保持する。certification単位の複数draftはresume選択を要求する。
- `earned_certifications`: certification IDで和集合。最も早い`recorded_at`はcanonical候補として示すが両raw rowは保持する。
- `assessment_answers`: assessmentごとの異answerは選択を要求する。
- `roadmap_profiles`: 異revisionは選択を要求し、将来writeのrevision floorを`max + 1`として示す。
- `dashboard_settings`: 異なるsettingsは設定全体を選ぶ。field単位で混ぜない。
- `fundamentals_*`: unit/contentVersionごとにcompleted IDを和集合し、IDsは重複なしの文字列だけを受け入れる。
  catalog順序は現snapshotに含まれないため、異なるfurthest positionは連続性を捏造せずreview-required conflictにする。
  passed finalは実在するsubmittedかつpassed sessionだけを許す。複数draftは保持しactive/resume選択を要求する。
- `migration_manifests` / `migration_items`: source name/fingerprintでvariantsを保持し、同一variantだけduplicate。
  異なるvariantはreplay head選択を要求し、items/outcomesを合成しない。
- `learning_state`: 両raw stateを保持し、このsliceではcanonical generationを選ばない。
- 異provenanceでevent/exam/final/manifest IDが衝突したらremap-required conflictにし、exam response、final
  progress、migration itemの参照候補もdetailへ保持する。選択肢は必ず`provenance:identity`で区別する。
- final passは同一provenance・同じunit/content versionのsubmitted/passed rowかつsubmission時刻/hashを要求する。
  duplicate finalはtarget provenanceのduplicate rowを明示的なread-only参照候補として扱う。

## DoD

- 両側全12 tableが非空のgolden、全row coverage、verified duplicate、同ID異payload event保持/remap、保持漏れ、
  未知/不足table、raw column、重複identity、owner binding、同一account、invalid auxiliary、pass証明不整合の
  回帰を含む。
- TypeScript strict、Biome、150行制限、標準`bun run check`を通す。
- native/DB mutationはこのsliceの検証対象に含めず、#58全体完了とも扱わない。
