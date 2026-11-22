# #59 アカウントの言語・テーマ設定

関連: [Issue #59](https://github.com/HiroyukiFuruno/katana-aws-qualification/issues/59)。#58の整理・公開後、既存のAuth UIDを所有者として実装する。別アカウント統合やゲスト履歴移行は前提にしない。

## As-Is / To-Be

| 対象 | 現状 | 今回の差分 |
| --- | --- | --- |
| 取得資格 | 既存のprofile/RPCが会員DBへ保存し、別端末でも復元する | 同じ正本と既存の編集導線を設定画面から使う |
| 言語 | URLが表示言語、端末設定だけを保持 | アカウントの既定言語を保存。通常ページの明示URLを維持し、ログイン後・ホームの既定遷移で保存値を使う |
| テーマ | 端末のlight/dark、未指定ならOSに追従 | 会員はDB値、ゲストは既存端末値。設定解除時はOSに追従する |
| ウィジェット配置 | dashboard_settingsに本人の設定を保存済み | 内容とrevisionを変更せず、同じ行へ独立した表示設定を追加する |

## 保存契約

- 既存 `public.dashboard_settings` に `site_locale`（対応10言語またはnull）、`site_theme`（light/darkまたはnull）、`site_revision`（非負整数）を追加する。nullはアカウント指定なし。
- `load_site_preferences(p_expected_generation)` と `save_site_preferences(p_locale, p_theme, p_expected_revision, p_expected_generation)` は `{locale, theme, revision}` を返す。
- 本人は既存の `require_learning_generation` で検証する。UIDをクライアント引数にしない。RLSと直接書込拒否を維持し、保存は既存と同じ改訂競合・世代検査を使う。
- ダッシュボード配置のrevisionと表示設定のsite_revisionは独立。各RPCは自分の列だけを更新する。
- 学習リセットで表示設定を消さない。表示設定の初期化で学習・取得資格・ウィジェット配置を消さない。退会は既存の本人削除とFK cascadeを使う。
- 既適用migration15件を変更せず、削除済みの試作版番号を再利用しない `202611220005_site_preferences.sql` を追加する。

## 画面と状態

- 既存ヘッダーの言語・テーマ操作を維持し、会員の保存状態と設定画面を同じ正本へ接続する。ゲスト端末値を自動でDBへ取り込まない。
- 読込中、保存中、保存完了、読込失敗、保存結果不明、改訂競合を区別する。失敗を保存成功と表示しない。
- 別端末の更新は古いrevisionで上書きしない。利用者がクラウドから読み直し、必要なら再度変更する。
- 以前のアカウントの遅延応答は現在の表示・保存へ適用しない。ログアウト後はゲストの端末設定へ戻る。
- 言語・テーマの読込失敗で認証成功を失敗にしない。ログイン後の既定言語を読めない場合はcallbackの言語でダッシュボードへ進み、設定の読込エラーを表示する。
- 翻訳は全10言語へ追加し、UI文字列をハードコードしない。

## 検証と公開

- [ ] 実Auth/DBで2ユーザーの読取・保存・RLS・不正入力・競合・世代・reset/delete・配置設定との独立性を検査する。
- [ ] 別browser contextで保存/復元し、所有者切替、URLの優先順位、ゲスト設定、失敗時の表示、再読込を検査する。
- [ ] 全言語・light/dark・mobile・keyboardと既存品質検査を維持する。Mock/固定待機/timeout延長は追加しない。
- [ ] Draft→review回収/修正/reply/resolve→P0/P1ゼロ→Ready→実required設定確認→通常merge→DB適用→公開URL確認まで行う。
- [ ] 正式証跡を保存し、不要なビルド出力・検証用コピー・一時フォルダーを削除する。

既適用foundation/owner-shadowの検査は当時のmigration1〜15の境界を維持する。通常のdata/progress検査で新しい表示設定migrationまで検査し、過去の独自統合フローは再導入しない。
