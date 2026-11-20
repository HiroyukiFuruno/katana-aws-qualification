# 学習データ永続化契約

ログイン中の学習記録の正本はSupabase Postgresであり、全ての所有者は`auth.uid()`で決まる。クライアントは`user_id`を送らず、テーブルへの書込み権限も持たない。ゲストの同意済み端末保存と、ユーザーIDに束縛した一時再送キューは、このDB正本とは別である。

## 適用状態

- `202611200001_learning_schema.sql`、`202611200002_learning_writes.sql`、`202611200003_learning_summaries.sql` は PR #51 と main `9ef8a7e` で本番適用済みである。
- `202611200004_profile_snapshot.sql` は profile 読取りを単一 snapshot にする後続 migration であり、レビュー前・未公開である。001〜003 を書き換えず、承認後に後続 migration として適用する。
- `202611200005_exam_clock.sql` はサーバー時刻読取りとconfirmed保存を追加する未適用migrationである。選択時刻をサーバーで決定し、既存v1の期限・世代・改訂検査を維持する。004と005はレビュー・merge後に適用する。
- DB migration の適用済み状態と、#23 の frontend/outbox/模試 P1 の公開状態は別である。後者は並行レビュー中で、利用可能・検証済みとして本書から約束しない。

## RPC

- `initialize_learning_state()`は、初回だけ本人の`generation`を作成して返す。`learning_state`は本人だけが読めるRLSテーブルである。
- 全ての書込みRPCは`p_expected_generation`を必須にする。`append_learning_event`はさらに`event_id`と正規化済みJSONのSHA-256で再送を冪等にし、同じIDで異なるpayloadを`23505`で拒否する。
- `start_exam_session(...)`は固定された`question_order`、サーバー時刻で計算する`deadline_at`、初期`revision`を返す。同一入力の再送だけが同じ試験を返す。`save_exam_response(..., p_expected_generation, p_expected_revision, ...)`と`finalize_exam_session(p_exam_id, p_expected_generation, p_expected_revision, p_events)`は世代と楽観ロックを使う。締切後の保存、固定順序以外の提出、異なるpayloadでの再提出は拒否する。締切後の自動採点は、締切前に保存された選択・選択時刻・所要時間・flagと完全一致するpayloadだけを確定する。responseがない設問、および選択時刻なしでflagだけを保存した未回答設問は、空選択・不正解・報酬0のときだけ許可し、クライアント時刻を使わず有効終了時刻を回答時刻に固定する。`submitted_at`は採点上の有効終了時刻（受信時刻と締切の早い方）、`submitted_received_at`はサーバーが確定要求を受信した実時刻である。提出済みへの同一payload再送だけは同じ`submitted_at`を返す。
- `read_learning_clock(p_expected_generation)`は本人の世代を確認してサーバーUTCを返す。`save_exam_response_confirmed`は回答位置と移動先cursorを分け、同一トランザクションで保存する。同一選択のflag変更・移動では選択時刻を保持し、選択変更時だけ更新する。未回答flagは時刻null/所要0の既存契約を保つ。
- `load_roadmap_profile_snapshot()`は認証済み本人を確認し、取得資格・査定・改訂を単一MVCC snapshotで読み取る。
- `replace_roadmap_profile(..., p_expected_generation, p_expected_revision)`も同じ二重ロックを使い、取得資格と査定回答を置換する。JSON `null`は置換対象ではなく不正入力として拒否し、保存済みprofileを消さない。移行RPCも世代を必須にする。
- `reset_my_learning_data(p_expected_generation)`は呼出し本人のデータだけを削除し、同じトランザクションでgenerationを増やす。reset前のタブや遅延再送は`PT409`で拒否され、履歴を復活させられない。
- generation不一致はPostgREST HTTP 409になる専用SQLSTATE `PT409`、試験・profile revisionの競合は`40001`である。前者ではキューを破棄してstateを再読込し、後者では最新の対象だけを再読込して利用者に競合を示す。

## 既存端末データの明示的移行

移行UIは、下記の各入力について本人の操作後にmanifestを開始する。成功・拒否を含む行数が宣言値と一致するまで完了にしない。元の端末データとCookieは、件数と内容を照合するまで削除しない。

| manifest source | 既存入力 | 扱い |
| --- | --- | --- |
| `history-local-storage` | `saa-study.attempts.v1` | 各履歴行を回答イベントとして追加する |
| `wrong-cookie-v1` | `saa_study_incorrect_v1` とlocal fallback | 回答イベントを作らない。履歴から再構成後に照合・失効する |
| `exam-draft-local-storage` | `saa-study.exam.v1` と`katana.certification-exam.v1.*` | 固定順序・期限を検証できる場合だけ移行し、そうでない下書きは理由付きで拒否する |
| `profile-local-storage` | `katana.certification-profile.v1` | profile置換と行記録を同一移行処理で行う |
| `wrong-index-local-storage` | `saa-study.incorrect.v1` | 旧Cookie保存失敗時のJSON誤答ID索引。全IDがクラウドの不正解履歴から再構成できる場合だけ照合後に削除し、日時・回答イベントは作らない |

旧試験は`import_exam_session`でmanifestの1行に束縛して取り込む。入力には元の`started_at`、`deadline_at`、固定`question_order`、draft response、提出済みなら全exam eventを含める。DBは元の期限をそのまま格納し、期限切れdraftの再開や新しい開始時刻による延長を拒否する。manifest行は取り込んだexam IDと全入力のSHA-256を記録し、同一payloadの再送だけを許可する。取り込み済み提出の`submitted_at`は検証済みの元時刻、`submitted_received_at`はこのサーバーへの取込受信時刻として区別する。時刻が欠ける旧形式は`legacy_import`として明示し、`submitted_received_at`を捏造せずnullのままにし、再開可能なdraftにはしない。試験行・回答イベント・manifest行は1トランザクションで確定する。

profile移行は`import_roadmap_profile(...)`がprofile置換とmanifest行の記録を同一トランザクションで行う。manifest行にはprofile payloadのSHA-256を記録し、同一payloadの再送は現在のrevisionを返すだけで、他端末・他タブの後続更新を上書きしない。異なるpayload、または新規行でのrevision競合は拒否してprofileとmanifest行を変更しない。

## 集計

`learning_summary`の`p_from`/`p_to`は表示IANA timezoneからクライアントが算出したUTCの半開区間`[from,to)`である。期間は全履歴を指定でき、`p_certification_id`は`null`（全資格）または資格IDで全指標・日次・模試へ一貫して適用される。分母は本人・範囲・mode・資格に一致する保存済み回答イベントだけであり、0件のaccuracyと平均所要時間は`null`である。日次配列`daily`は`displayTimezone`で日付化する。`review_queue_by_revision`は同じ設問改訂の最新回答が誤答のものだけを返し、過去改訂は混ぜない。

退会処理は認証済みのサーバー側で`auth.users`を削除する。全データは外部キー`on delete cascade`で消える。ブラウザ側の再送キューとキャッシュは、その成功応答後に同一ユーザーID分だけ破棄する。

## 統合検査の認証境界

`test/data`は独立したGoTrueで2ユーザーを実際に作成し、そのアクセストークンを実PostgRESTへ送る。テスト専用DBの`auth.uid()`は、Supabaseが案内する`request.jwt.claim.sub`と`request.jwt.claims`の`sub`を読む互換ブリッジであり、ユーザー作成・JWT発行・署名検証を代替しない。これにより、SQL契約テストの`SET LOCAL ROLE authenticated`と`request.jwt.claims`、HTTP経由のRLSを同じ認証モデルで検査する。根拠: [Supabase Knowledge Base](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7)、[Supabase RLS reference](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 適用・復旧・容量

適用済み migration を rollback SQL で逆適用して学習データを削除しない。障害時は書込みを止め、修正 migration による前方復旧を優先する。物理復元が必要なら、まず隔離環境へ復元して対象個人データと差分を検証し、本番を直接上書きしない。

運用ポリシーは、変更前の復元可能な暗号化済み論理 backup、隔離環境での復元手順検証、`learning_events` と索引を含む容量の定期確認、保持方針変更前の個人データ影響レビューである。一方、現行 repository には backup 取得・保管・保持期限・PITR・容量アラートを自動化した設定はない。これらを設定済み・稼働中とは扱わず、実運用で設定した証跡を別途残す。

## 公開前バックアップの検証記録

2026-11-20の本番読取で001〜003の保存済みSQLと追跡ソースのSHA-256一致、全9テーブルのRLSを確認した。004追加前の対象publicテーブル（全て0行）と適用済みmigrationを、認証タグ付きAES-256-GCMで暗号化し、Supabaseとは別のMacへ保存した。暗号化鍵はMacキーチェーンの専用サービスで保持し、コード・ログ・文書に記載しない。復号結果の全バイト一致を検査した。これはpublic学習データの適用前保存であり、Authユーザー全体のバックアップや定期自動化、別プロジェクトへの復元試験を実施したという意味ではない。実行証跡は`test-results/data/production-source-checksums.json`、`production-before-profile-snapshot.json`、`production-backup-before-004.json`に記録する。
