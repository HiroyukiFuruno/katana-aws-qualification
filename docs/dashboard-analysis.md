# ダッシュボードの集計・表示契約（#24）

## 記録と分母

会員は自分のDB集計、学習保存に同意したゲストはこの端末の信頼済み履歴を使用する。未同意時は履歴を読み込まず同意・無料登録を案内する。会員の失敗時にguestへ切り替えない。保存設定は学習履歴と分離する。

回答数は選択なしで提出された問題も含む。正答率は正答数/回答数、0件はnull。時間は保存済み回答時間のみで、休憩・読書時間や試験の推定所要時間を足さない。SQL/guestは合計から加重計算し、平均の平均を使わない。復習候補は選択条件内の最終回答が誤答である問題（模試を除く）。問題ID・改訂・sourceVersionを同一性に含める。

## 条件

RPC `dashboard_summary(p_query,p_expected_generation)` のqueryはrange/certificationIds/categories/modes/contexts/formats/polarities/revisions/unitIdsの9項目のみ。rangeはfrom（全期間はnull）/to/timezone。UTC半開区間で、7/30/90日は表示timezoneの今日を含む暦日数、toは適用時刻の1ms後。夏時間境界を固定24時間へ置き換えない。

配列nullは全件、空配列は不正。periodは7d/30d/90d/all、既定30d。modeはstudy/review/exam、contextはpractice/exam/lesson-checkpoint/lesson-final、formatはchoice-single/choice-multiple/ordering/matching/unknown、polarityはcorrect/incorrect/unspecified。通常問題の正誤選択方向を本文から推定しない。改訂はsourceVersionとquestionRevisionの組。

widget overrideで未指定項目は全体条件を継承、明示nullは全件に戻す。同一の解決済み条件は集計を共有し、所有者・世代・要求世代が変わった結果を棄却する。

## 図の対応

| widget | 図の候補 | 主な値 |
|---|---|---|
| overview | 指標カード | 回答数・正答率・回答時間合計/平均 |
| trend | 折れ線/棒/面 | 日次件数・率・実測時間 |
| calendar | カレンダーヒートマップ | 日次回答数/時間 |
| certifications | 棒/正誤積み上げ/ドーナツ | 資格別件数/率/時間 |
| categories | 棒/正誤積み上げ/レーダー | 資格・分野・出典版・改訂別 |
| modes/contexts | ドーナツ/正誤積み上げ | 学習mode/回答context別 |
| formats | 棒/積み上げ/ドーナツ | 問題形式または選択方向 |
| revisions | 棒/正誤積み上げ | 出典版・改訂別 |
| durations | ヒストグラム/箱ひげ | 実測回答時間の分布 |
| relationship | 散布/バブル | 分野別回答数×正答率×平均時間 |
| reviews | 表/棒 | 最終誤答・誤答回数 |
| exams | 折れ線/棒/表 | 提出済み受験回の記録 |
| lessons | 棒/リング/表 | 現在の読了/中間確認/合格 |

初期表示はoverview/trend/calendar/certifications/categories/modes/reviews/exams/lessons。14種類から最大20instanceを追加でき、表示・順序・幅・適合する図と指標・個別条件を保存する。並べ替えはキーボード操作可能。

ドーナツは2系列以上、レーダーは同じ資格/出典版/改訂の3分野以上で各5回答以上に限定し、条件不足を説明する。すべて同内容の数値表を備える。正答率の円グラフ、率同士の積み上げなど不適切な組み合わせは選択不可。

分布binはms単位で[0,1000),[1000,5000),[5000,10000),[10000,30000),[30000,60000),[60000,120000),[120000,300000),[300000,∞)。p05/p25/p50/p75/p95はpercentile_cont相当の線形補間、0msも実測値として含める。

## 受験回と現在の進捗

フィルタで絞ったstatsと受験全体のallAnswersを区別する。模試のAWS換算点・推定合格率は生成しない。旧guest模試の開始/提出日時は不明のまま保持し、時系列から除外して表の末尾に掲載する。最終回答時刻は提出時刻と呼ばない。基礎最終のみ保存済み12問/10正答の合格判定を表示する。

現在の単元進捗は既存summaries RPCから別途読み、資格/単元条件のみを適用する。期間・回答形式・正誤方向による回答集計ではないと明記する。壊れたguest行・信頼済み教材と照合できない行は元記録を保持し、除外件数を表示する。

## 保存と検証

設定schemaVersion1、memberは専用テーブル/RPC・guestは同意時のみ専用キー。学習リセットで設定を消さず、退会でcascade削除。同payloadの再保存はrevision不増、異payloadの古いrevisionはPT412、世代変更は先にPT409。競合時に勝手な上書きや旧ownerの再試行をしない。不正な保存設定は警告と初期表示を提供し、明示保存まで原文を保持する。

Close条件は全分析軸/図/個別条件/保存/所有者競合、同一固定入力のSQL・guest一致、実Auth/Postgresブラウザ、10言語・明暗・320/390px・keyboard・表、既存品質ゲート、Draftレビュー手順、DBと本番サイト公開後の照合である。実行前のチェックを完了扱いしない。
