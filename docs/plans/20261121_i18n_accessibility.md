# #75 アクセシビリティ文言の直書き検査補強

一次要件は[多言語ハーネス](20261121_i18n_harness.md)とIssue #75。PR #77の静的検査を追加点検し、読み上げ用文言の検出漏れを公開前に補う。UI・辞書・教材データの変更は含めない。

- [/] ユーザー指摘: 多言語化漏れを、画面文言の直書きを禁止する静的解析で再発防止する。
- [x] JSX/spread/setAttributeのaria-placeholder・aria-roledescription・aria-valuetextを共通の表示属性定義へ追加する。
- [x] DOMのalt・ariaLabel・ariaDescription・ariaPlaceholder・ariaRoleDescription・ariaValueText代入を検出する。
- [x] 属性名の定数/importとcomputed propertyを既存traceで解決する。dot propertyや未解決の変数名から属性名を推測しない。
- [x] 翻訳済みalias、非テキストARIA enum/URL、dot名と同名変数、computed keyの非表示属性を誤検出しない回帰を追加する。
- [x] 生error.messageの新シンクも検出し、除外・baseline・無効化で逃がさない。
- [ ] 全check・自己/PRレビュー・指摘対応・Ready・必須CI・通常merge・公開確認を回収する。

## 検証

`test-results/i18n/aria-red.log`→`aria-green.log`で、新しい属性と属性名aliasの検出漏れを再現・解消した。最終のスキャナ単体は346件成功、350ソースの直書き違反0。strict TypeScript・Biome・重複0も確認済み。親の全checkは最終候補を固定して回収する。

共有の表示属性定義を追加し、JSX・spread・setAttribute・DOM代入の定義が別々にずれないようにする。完全な汎用データフロー解析を保証するものではなく、未知の動的属性名を推測して誤判定しない。

PR #77単独でIssue #75を自動Closeしない。補強差分と公開確認を回収した後にCloseする。GitHub Actionsの請求/利用上限による起動制限は既存の公開待ちであり、CIを通過したと扱わない。

`aria-candidate-check.log`は固定候補tree `67acca448c445d5f8b55df8f38f500f561ea367f`で全check成功（681件・4,018検証、693文言/10言語、350ソース違反0、重複0、型・教材・構造・build成功）。入力archive/lockfile SHAを`aria-candidate-source.json`へ保存した。`src`・`public`・locale辞書は変更しておらず、アプリ境界の既存実画面/認証/学習/DB検査はPR #77の記録を保持する。CLI検査の変更をアプリ画面の変更と誤報しない。
