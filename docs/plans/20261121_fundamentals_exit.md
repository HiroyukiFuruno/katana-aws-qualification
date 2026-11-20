# #67 スライド終了・チェックポイントの操作修正

一次情報: 2026-11-21ユーザー指摘「スライドモード終了する手段がない」「途中のチェックポイントって回答しなくても次に進める」。関連Issue #67 / #25。

## 現状と修正方針

- [/] 終了導線が上部の「基礎学習の目次」リンクだけで認識しづらい。固定操作部へ「学習を終了」ボタンを明示し、既存目次リンクも維持する。
- [/] Nextの判定が過去のcompletedCheckpointIdsのみを参照するため、再訪・再回答時に未回答/未採点表示でも進める。現在画面で採点確認するまで無効にする。誤答時も解説を確認した後は進める（最終テストの12問/10正答基準は維持）。
- [/] 最新追加指示: 最終テストも指定数を選択するまで「次へ」「回答を提出」を無効にする。最終テスト開始前の説明画面は開始可能。旧データや直接APIからの未回答を誤答と扱う採点・保存境界は維持する。
- [/] 終了は目次への中断であり、読了や合格を加算しない。一時ゲストのSPA内保持、同意済み端末/会員の再開を維持する。
- [/] 最終テストの現在の回答は既存の保存処理を経て終了する。未同期の会員コマンドを廃棄しない。保存領域に保持できなかった内容を保存済みとして終了しない。
- [/] 最新の実機FB: 「前へ」だけ文字リンクで「次へ」と不揃い。枠・余白・重み・高さを揃え、スマホは左右同幅の操作欄と下段の終了操作へ分離する。
- [/] 画像7421: 広告を表示したまま操作を阻害しない。広告を外側gridの自動高さ行から本文scroll領域へ移し、本文行をminmax(0,1fr)にして外側の高さを確保する。広告自体の高さを縮めたり切り取る処理は追加しない。

## 実装・検証

- UI: LessonSlideShell / LessonSlideFooter / LessonStepScreen、必要な小さな終了処理、10言語。
- 純粋な終了制御の単体テスト: busy、正常保存、耐久キュー保持、未保存エラー、読み取り中断。
- 実GoTrue/Postgres/browserで終了/再開、現在回答の採点ゲート、再訪・再回答、最終回答保存・未同期を検証する。Mockは単体のみ。
- 既存の全12単元の320/390px・横画面・200%文字サイズ検査と明暗/keyboard/10言語、品質ゲートを維持する。
- [x] RED再現→実装→GREEN、既存関連integrationとcheck。
- [x] Draft→自己レビュー/@codex review→指摘対応/reply/resolve→Ready→CI→merge→公開URLの実動作確認→Issue Close。

## 作業境界

#24の差分はrelease/dashboardの3b16a8b・ccbe430へコミット保持した。新規worktree/stashは作成せず、既存checkoutのrelease/fundamentals-exitで本修正を先行する。公開後は#68の設問内容修正を仕上げ、その後#24へ戻り、先行修正を取り込んで残DoDを継続する。既存実アカウントの統合・削除は行わない。

## 検証記録

未実行の検査を完了扱いしない。本人確認は非ブロッキングの独立フォローアップとし、担当の実装・自動検証・公開でCloseする。

- `issue67-red.log`: 出口不存在・CP再訪の未採点通過・会員最終中断の3ケースでRED。
- `issue67-green.log`: 3/3成功（8.7s）。`issue67-native-regression.log`: 66/66成功（2.9m）、全12単元の320/390・横画面・200%文字と一時ゲストSPA/会員最終/実通信断時の耐久キュー保持を含む。
- 本人の最終未回答禁止指示を追加後、`issue67-final-required-red.log`で未回答Nextが有効なことを再現。`issue67-final-green.log`20/20成功（58.4s）。不合格テストは未回答で飛ばす旧操作から指定数の誤答を選ぶ操作へ変更し、合格基準を緩めていない。未回答を誤答とする既存純粋採点テストは維持。
- `issue67-layout.log`: 10/10成功（15.5s）。全10言語×320/390px×light/darkで終了ボタンの幅・44px・キーボードEnter・言語維持を検証。`issue67-exit-390-dark.png`を確認。
- `issue67-ready-check.log`: 272単体/2836 assertions、品質・教材生成・3540 public/1560 private lesson routes・30 account shells/build成功。既存14警告とbundle警告は無効化していない。`issue67-dependencies.log`/`issue67-audit.json`: 直接/推移依存とlockfile確認、更新候補・脆弱性検出なし。
- 自己レビュー: 現在画面の確認だけをgateにし、過去の合格/読了記録を書き換えない。会員finalは保存成功または耐久キューを確認して中断し、古い画面の非同期完了では遷移しない。変更にDB migrationは不要。
- 内容品質の新指摘は#68で192問の監査と個別修正を追跡し、本Issueでは完了扱いにしない。
- 追加の広告/操作欄: `issue67-ad-layout-red.log`で部品単体9件の失敗を再現。`issue67-ad-layout-green.log`9件/90assertions成功。実コンポーネントとCSSをSSRして実ブラウザで幾何・hit testを行い、広告入力0/300/900px・320/390/横画面でも操作欄の表示、左右同幅、元の広告高さ保持を検証する。これはUI単体の入力試験であり、IT/E2EのサービスをMockしない。
- ブラウザが必要な部品単体は`fundamentals-controller-layout.unit.tsx`とし、Chromium導入後の既存`progress:integration`入口で必須実行する。Chromium導入前の通常`bun test`へ環境依存を混入しない。
- `issue67-ads-mobile.log`: 部品単体9成功＋実Auth/DB/browser63成功（2.6m）。全12単元の320/390・横画面・200%文字、10言語/明暗の操作欄同寸法・viewport内表示・終了/再開・実通信断を再検証。更新した390px画像を確認。
- スライド内だけ`data-full-width-responsive=false`を指定する。広告をモバイル画面全幅へ自動拡張させない公式パラメータで、他ページの既定表示は維持する。一次資料: https://support.google.com/adsense/answer/9183460?hl=en
- PR69のP1（thread `PRRT_kwDOVzQ52c66GqJL`）を採用。`hasPending`はメモリ上の未永続化コマンドも含み、耐久性の証明には使えなかった。現在のcommandをrefで追跡し、本人・現世代の保存原文に同じID/全payloadがあることを確認するAPIへ置換した。別commandの保存済み状態や過去のpersistedIdsを根拠にしない。
- `pr69-quota-red.log`: 実ブラウザのlocalStorageを実際に容量上限まで埋めて、不適切に目次へ遷移することを再現。storage APIのMockやHTTP差替えは使用していない。
- `pr69-quota-green.log`: 修正後の容量不足/空き確保/同じcommand再試行/再開、通信断での耐久キュー保持、通常終了を含む実Auth/DB/browser5件成功（19.8s）。メモリ保持と耐久保存の区別・別commandの誤認・別タブ削除の単体回帰を追加。
- `pr69-durability-check.log`: 274単体/2853 assertions、既存全品質ゲートとbuild成功。修正commitのpush後にthreadへreply/resolveし、同じHEADで再レビューとCIを回収する。
- CI初回はAuth成功、Progress132成功/1失敗。終了ボタン追加で既存の再試行テストの曖昧なbutton指定が2件一致したため、表示名「再試行」を明示した。`pr69-member-retry.log`で該当ファイルの実Auth/DB/browser全件が成功し、`pr69-selector-check.log`で274単体/2853 assertionsと全check/buildも成功。検査の条件やtimeoutは変更していない。新HEADのレビュー・CIと公開は引き続き回収する。
- 147ba10のAuthは成功。Progress run44790184497はAzureのUbuntu mirrorから21.9MB取得に6分27秒（56.4kB/s）かかり、15分のjob上限で中断した。再実行でもブラウザ準備に約8分を消費したため、同じ署名付きUbuntu packageを取得する公式archiveへhostだけを変更する。APTの署名検証・package/Playwright/OS版・全検査・15分上限は維持する。`pr69-ci-browser-delay.log`に元の取得速度と上限の証跡を保存した。
- e55afffの初回は取得先設定が間接参照形式であるため、期待する直接hostが見つからず準備前に停止した。GitHub公式runner imageの`configure-apt-sources.sh`で`mirror+file:/etc/apt/apt-mirrors.txt`を確認し、参照先mirror listをUbuntu公式archive/securityの優先順へ設定するよう修正した。未知形式では失敗させ、元の遅い取得先へ黙って戻さない。公式資料: https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/configure-apt-sources.sh

## 公開完了（2026-11-21 JST）

PR69のcandidate `9d1b25c839e02613b22a8c11cbfc705b4d790fee`をmain `cd4cb39683a1e0cf386db0a638885b00227509e7`へ通常merge。最新HEADのレビューは指摘なし、全thread解決。mirrorのescapeに関するP1は実原文バイトとBash出力（タブ2/改行2/2 URI行）と実CIの依存導入21秒で反証し、不採用の根拠をreply/resolveして再レビューを回収した。

`pr69-ci-auth-success.log`: 164件成功。`pr69-ci-progress-success.log`: 実Auth/DB/browser133件＋部品単体9件/90assertions成功。品質ゲート・15分上限は維持した。

`production67-source.json`: deployment `dpl_ArapBnos7sYkrSGfKnD1SrV2Xkma` / READY / custom domainの上記main一致。`production67-qa.json`: [公開URL](https://kaq.katana-projects.org/ja/study/fundamentals/)の390×700ブラウザで読書/最終の終了・再開、CP再訪の確認必須、最終12問の選択必須、12/12採点、footerがviewport内、学習Cookie0・analytics通信0を検証。`production67-final-required.png`は実際のfieldset表示を待って撮影し確認した。Issue67は公開照合後にcompletedでClose。

公開済み修正をrelease/fundamentals-contentへ取り込み、不要なlocal release/fundamentals-exitを削除。remote branchは保持、新規worktree/stashは作成せず、他の使用中worktreeは維持した。
