# 件数表示の単数・複数対応

## 要件と境界
- [x] サイト全体の自然翻訳要件のうち、実際に確認した1件の英語複数形誤り（countLabel/lessonStepsRemaining等）を修正する。
- [x] 原文・9訳の既存720基本辞書は保持し、数量別の訳文は外部言語データへ追加する。コードへ表示文を埋め込まない。
- [x] 既存tの呼出し契約を保ち、単数と複数および複数の件数を含む文を扱う。lessonFinalRulesのtotal/correctは独立して判断する。
- [x] 全パラメーター付き画面文言と呼出しを点検し、savedAnswers/missedCount/examLength/countLabel/lessonStepsRemaining/progressPending/progressMigrationRejected/dashboardExcludedRecords等を含める。略語単位や固定の見出しは不要に変更しない。
- [x] dashboardExcludedRecordsはt結果へ後からreplaceしており件数がtに渡らないため、この種の呼出しも修正する。
- [x] 全10言語で自然な単数・複数を用意し、非屈折言語の既存表現は保持する。新規翻訳サービスは利用しない。
- [x] 既存i18n lintから追加データの言語/キー/形/空文字/プレースホルダーを検査する。無効化・除外・単なる正規表現置換で逃げない。
- [x] 実バグの回帰（1/2件、複数operand、各言語・0件等の意味のある対照）、型/i18n型/i18n lint/書式/単体と適切な実browser確認を行う。E2E Mock・固定待機は禁止。SAA-C03の実配信データでPickerの1/2件とen→es切替を確認した。

## 実装制約
既存release/aip-c01-mockで作業。commit/push/deploy、新規worktree、stash、問題バンク/自然翻訳cache/公開翻訳ファイルの編集は禁止。既存の未コミット差分を保持する。新規の大きなi18n依存は追加しない。中央の小さなformatterと外部variants/operandデータによる既存設計への拡張を優先する。Intl.PluralRules等で対応言語の規則を扱い、欠落や予測不能な値を黙って隠蔽しない。既存のテンプレート取得契約や0件の表現の扱いも明文化する。

## 現時点の証拠
src/preferences.tsxは単純なplaceholder置換のみ。src/fundamentals/learner/LessonSlideShell.tsxはremainingStepsが1になり得る。src/QuestionSetPicker.tsxはcountLabelに件数を渡し、src/ExamFormatPicker.tsxはcustom length=1も扱う。src/dashboard/ui/DashboardWidgetState.tsxはt(...).replaceで件数を後置換している。

## 検証結果
実装・翻訳候補と結果は `docs/reviews/20261122-ui-quantity-pluralization-candidate.json` と `output/question-quality/ui-quantity-*.log` に記録する。再レビューP1として全EU localeのlessonFinalRules 4組合せとselected/glossary operand境界を `scripts/quantity-operands.test.ts` に明示期待値で追加し、全unit 468件を再回収した。全件の問題翻訳は別の継続タスクとして停止しない。

## 最終採用（2026-11-22）
- [x] 初回main指摘5件と独立指摘（閉じたform集合・全6言語の複数operand期待値・古いcandidate記述）を解消。最終P0/P1/P2=0。
- [x] mainが132自然訳を採用し、44パラメーターキー=20数量+24既存表現の完全一致と720辞書SHA不変を確認。
- [x] 全468単体/5202期待値/172ファイル、型/i18n型/720キーlint/850ファイルformat、実SAAブラウザ、architecture/duplicates/41原文bank/12基礎単元/production build成功。
- [x] 隔離した実check-localesで正常通過→placeholderを保ったFR単数形への日本語混入を失敗として検出。
- 全体i18n:contentは未翻訳の英語原文MLAに必要なJA manifestが欠落して失敗中。免除せず、元の全5157問翻訳作業を継続する。
- 採用証跡: docs/reviews/20261122-ui-quantity-main-acceptance.json。AI生成を3 workerへ復帰。
