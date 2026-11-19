# ログインボタンのベンダー別デザイン

## ユーザー指摘

- [/] ログインボタンへ各サービスのアイコンとカラーを取り入れる。

## 固定する実装・検証条件

- GitHubは白黒の公式マーク、Google・Microsoftは正式な多色マークとneutral面、Facebookは正式な青系を使う。ロゴをAIで作り直さない。
- ログイン・アカウント連携・ブラウザ変更後の再開で同じボタンを使い、認証の処理は維持する。
- 実際に有効化済みのサービスだけを表示する。Amazonは本人承認済みの保留で、無効なボタンを足さない。
- ライト/ダーク、320pxからデスクトップ、10言語のラベルで横はみ出し・重なりがない。文字コントラスト4.5:1、タッチ高48px以上、間隔8px以上、focus-visibleとbusy状態を検査する。
- IT/E2EにMockや固定待機を追加しない。全checkを維持し、Draft→review→指摘対応/reply/resolve→Ready→CI→merge→公開確認の順で完了する。

## 実装・検査

Issue #39。ProviderButtonsに公式SVGとベンダー別スタイル、focus/busy/折返しを追加。全checkと実Auth/browser32件が成功し、80条件のviewport/theme/localeを検査した。busy状態の一瞬そのものは画面離脱のため自動検査の根拠にせず、実GoTrueへのPKCE付き認可開始を検査する。
