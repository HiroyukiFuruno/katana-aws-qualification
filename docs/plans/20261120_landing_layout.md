# #33 ランディングのカード間隔とFAQ

## 目的

モバイルで学習・査定カードとアカウント案内が接する状態を解消し、FAQを読み進めやすい開閉形式にする。本人提供画像`7412.png`を根拠にする。

## 実装範囲

- ホームのentry gridとアカウント案内の間に24px以上、画面幅に応じて最大40pxの余白を置く。
- 案内は読み幅を68chに制限し、登録CTAと既存の具体的な価値を維持する。
- FAQはnative `details` / `summary` の3項目とし、通勤、ゲストとアカウントの違い、料金とSSO登録を全10言語で示す。
- 同期・分析は準備中であることを明記し、未提供機能を利用可能と誤認させない。
- CSSでQマーク、chevron、hover、focus-visible、light/dark、reduced-motionを扱う。

## 検証

- 実Auth環境のPlaywrightで320/390/768/1280px、light/darkについてカード間隔、重なり、横overflowをboundsで検査する。
- FAQのEnter/Space開閉、focus-visible、reduced-motionを検査する。
- `bun run lint`、`bun run typecheck`、`bun run i18n:check`を対象変更後に実行する。統合環境の起動は統括担当が一度だけ実施する。
