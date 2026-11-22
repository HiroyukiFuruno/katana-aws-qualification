# #58 認証切替時の未同期回答保持

## 目的と境界

既存のAuth UID別キューは、ログアウト・別ユーザーへの切替で削除しない。元のキューの原文とevent UUIDを保ち、別ユーザーには送信しない。既存の明示reset/dispose(true)による削除は維持する。学習account/epochへの新束縛・merge後の再送はこの差分で実施しない。

## 変更と検証

- [x] ProgressCoordinatorの認証切替でdispose(false)を使い、既存isCurrentチェックを保持する。
- [x] ログアウト・A→B→Aで元キュー原文保持/他owner非送信/再ログイン時元eventID再開を単体回帰する。
- [x] 既存transition race、明示discard/reset回帰、全checkを通す。
- [x] 実GoTrue/SDK/RESTのprogress統合4件で切替保存・元UUID再送・別owner非送信・既存削除を検証した。Mockは単体のみ。
- [ ] Draftレビュー、ローカル検証、公開を完了する。全#58完了とは扱わない。

検証記録: full898 tests/6235 assertions、実progress4件成功。`test-results/publication/outbox-retention-main-v2-gates.json`。CI復旧待ちはせず、ローカルの実検証とDraftレビューを根拠に公開する。
