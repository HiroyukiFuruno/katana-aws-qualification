# #23 模試のサーバー時刻と期限

## 再現と固定条件

`persistence-final-progress.log` の before/after finalize 2件が `save_exam_response` の HTTP400/22023 `invalid exam response timing` で停止した。30秒待機不足やブラウザ表示警告ではなく、端末の選択時刻をサーバーの現在時刻と厳密比較したことが原因。時刻の許容幅追加、検査の固定待機、timeout延長、001〜003の書換えでは解決しない。

## 実装契約

- 追加migration005に、本人・サーバー世代を確認する `read_learning_clock(p_expected_generation)` と `save_exam_response_confirmed` を追加する。
- confirmed保存は選択操作の有無をbooleanで受け、操作済みの選択時刻をサーバーの `clock_timestamp()` で決定する。既存v1保存RPCの世代・改訂・位置・期限・未回答/flagの検査を通す。時間や入力条件を緩めない。
- confirmedは `revision, selected_at, duration_ms` を返す。JSの数値へ変換するとDBのmicrosecondが欠落するため、レスポンスにサーバーのUTC文字列も保持し、最終イベントの `answered_at` と `selected_at` へ同じ値を渡す。
- memberの開始/再開はサーバーUTCと `performance.now()` のアンカーを持つ。UIの残り時間と期限判定はこの単調時計を使い、端末の壁時計を変更しても試験時間を延長/短縮しない。guestの既存契約は維持する。
- 回答所要時間は単調時計の差で測る。選択を一度もしていないflag-onlyは `selected_at=null, duration_ms=0` の既存契約を維持する。
- 提出準備では新しいサーバー時刻を確認する。期限前だけ最終回答を保存し、期限後はサーバーへ確認済みの回答だけを採点する。期限跨ぎの保存拒否は、サーバー時刻と実DB draftを再確認して期限後である場合だけ、保存済みの回答へ切り替える。
- 保存はDBで成功したが応答だけ失われた場合、サーバーの改訂・位置・選択・flag・所要時間の一致を確認したときだけ保存済みとして採用する。異なる改訂/内容を成功にせず競合を示す。
- 準備済みの同一改訂を再提出する際は、同じUUID/payloadを再送する。成功後の履歴はDB正本を再取得する。
- 既存の厳密なv1 RPC、payload hash、締切後の新しい選択拒否は保持する。新機能を本番へ適用するのはレビュー・merge後。

## 検証

- [x] 実DBでconfirmed timestamp・原時刻精度・未回答flag・改訂・期限・匿名/他user/旧世代拒否。
- [x] 単調時計を使い端末時刻の前後変更でmember残り時間を延ばさない固定入力検査。
- [x] 実GoTrue/DB/browserで通常保存、端末時刻ずれ、before/after応答喪失、期限後の自動採点、遅い保存の期限跨ぎを確認。
- [x] 全check・既存Auth162件・進捗全ケースを維持し、Mock/固定待機/timeout延長をITへ導入しない。

## 同じ検証で見つかった保存・再開の整合性

- confirmed RPCの`p_response_position`は保存対象の設問index、`p_position`は移動先cursorとする。旧v1を保存indexで呼んだ後、同じtransactionで移動先を記録する。
- 同一選択のflag操作・移動・提出時は既存のサーバー選択時刻を保持し、選択の変更時だけ更新する。
- DBの`exam_responses.question_key`はrefオブジェクトのJSON文字列。ブラウザのorderキー（`[id,revision]`文字列）へ正規化してから復元し、reload後の選択/flagを失わない。
- 実E2Eは空の試験再開だけで終えず、複数問へ回答・移動・reload・選択/flagの復元・提出を確認する。

実検査: `test-results/data/exam-clock-integration.log` と `test-results/progress/persistence-clock-full-progress.log`（19件成功）。`persistence-clock-final-check.log` 全155件成功。004/005本番適用・公開はレビュー後。

最終review P1解消後: `persistence-reviewed-check.log` 157件/1371 assertions、`persistence-clock-complete-progress.log` 実20件、`persistence-reviewed-auth.log` 実Auth162件すべて成功。再reviewのP0/P1は0件。
