# #112 AWS認定資格とは？ 解説ページ

## 最新指示と範囲

2026-11-23本人指示「112だけ公開して！」に基づき、FBと多言語化全体の待ちを本ページ公開の前提から外す。本ページの全10言語、既存品質・公開要件は維持する。現在のmain ae09a02cには全問翻訳PR118も合流済みで、その品質基準を下げない。DB/認証/FB設定を変更しない。

## 実装

- [x] 15文言を既存10言語辞書へ追加。Issue日本語本文を基準として自然な訳をレビューする。
- [x] /certifications/overview/と10言語のルート・固有title/descriptionを追加。
- [x] 本文は副作用を持たない共通React表示でクライアントと静的生成を共用し、空SPAシェルで本文検査を代替しない。
- [x] 3資格の比較表、ガイド一覧・個別ガイド・基礎学習・問題学習・AWS公式の導線を追加。資格一覧冒頭とLP学習開始セクションに入口を置く。
- [x] 生成HTML本文/アンカー/canonical/hreflang/sitemapを全10言語で実読検査し、既存buildへ組み込む。
- [x] 実ブラウザで10言語・375/1280px・両テーマ・入口/戻り/言語切替を検査。IT/E2E Mock禁止、固定wait禁止。
公開手順: Draft→自己/独立/Codexレビュー→指摘対応/reply/resolve→P0/P1ゼロ→Ready→実required確認→通常merge→本番source/URL/本文/導線確認→IssueClose。公開結果と未完了作業はIssue112と終了台帳に記録する。

## 追加要件: 広告

- [x] 2026-11-23本人指示「広告も入れてね」を採用。共通SiteAdをclient wrapperからpure本文の比較表後・学習開始前のslotへ渡し、SSRでwindow依存を持ち込まない。
- [x] 未同意時の非表示、同意後の本番配信flag、375pxで学習リンクを遮らない配置を検査。独自広告実装や新規providerを作らない。

## 一次情報

AWS認定公式 https://aws.amazon.com/jp/certification/ 、AWS認定試験ガイド https://docs.aws.amazon.com/ja_jp/aws-certification/latest/examguides/aws-certification-exam-guides.html 、Google内部リンク https://developers.google.com/search/docs/crawling-indexing/links-crawlable 。資格名/対象者/制度は公開前に照合する。

## 検証証跡

固定ソースの全check1022件、strict静的スクリプト検査を実施。最初の全検査が検出した補足試験コード表示を外し、直書き0を確認した。独立レビューの静的アンカー検査漏れは生成HTMLの全導線検査を追加して修正。10言語×375/1280×両テーマの40表示条件、入口20・リンク先50・戻り10、言語切替2、未同意広告0/同意後inline枠・学習リンク非遮蔽を実ブラウザーで検査。証跡はtest-results/seo112/に保持する。学習全体の広告漏れ・共通枠の余白改善は後続Issue119に分離し、本ページの公開へ混在させない。
