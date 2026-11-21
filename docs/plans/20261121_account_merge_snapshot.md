# #58 統合前の完全snapshot部品

本書は内部部品の記録であり、公開preview/統合機能の完了報告ではない。
基盤は全14migration、現在のpublic owner表12種類を維持する。

## 境界

- owner-onlyの`capture_learning_snapshot(account_ids)`が1〜2個のactive ownerを受け、昇順に正規化する。本人認証・両proof・lockはcallerで検証し、任意利用者から呼べる公開APIにはしない。
- 12表とprivate account/membership/receipt/archive/ID mapの5種類を、全列・NULL・全行・行数を保持した単一statement snapshotにする。
- 表ごとの安定順序row SHA-256集合と件数を作り、owner/表名/algorithm versionと共にさらにSHA-256化する。件数・日時・revision・既存hashを除外しない。
- 表示用documentとfingerprint/digestは同じ取得結果から導く。呼出し元のTimeZone/DateStyleを変えても同じ結果とする。
- 新しいpublic owner表を検出したら固定エラーにし、保護集合から黙って落とさない。後続設定・予定やmerge補助表を導入する際も集合と検証を拡張する。
- 出力にAuth credential、private proof runtime、nonce、verifierを含めない。raw documentはサーバー内部用であり、そのままbrowserへ公開しない。

## 検証

- [x] 標準account:integrationで実2 OIDCの後に既存seed-public.sqlを使い、12表すべてを非空にする。
- [x] 全列/行数、12表とprivate5種類への変更、scope異常、inactive/state欠落、新表の追加検出など60条件を実DBで検査する。
- [x] seedの公式Auth削除と全12表のcleanup、既存schema/全row hashの完全一致を照合する。
- [x] 独立した実PG競合11条件で、先行11表読取後の12表目に実lock barrierを置き、途中writerのcommitをまたいでも旧document/fingerprint/digestだけを返すことを確認する。次statementは新snapshot全体へ進み、意図した2表だけが変化する。
- [ ] Draftレビュー・指摘修正・必要CI成功・正式履歴/公開物への反映。

証跡は`test-results/account-merge/learning-snapshot-standard.log`、`integration/learning-snapshot-proof.json`、`learning-snapshot-concurrency-real.json`、各input SHAとblocking graph。最小競合検査をAuth/SSO再確認とは呼ばない。

## 残す条件

全writerのlock参加、両proofとconsent、previewのTTL/状態/一回性/完全digest照合、履歴の実移動・保持、既存FK/RLS/queue/cutoverは未接続。STABLE snapshotをlock待機後の権限再検査へ流用しない。GoTrue refreshとのlock逆順は別の未解決検証であり、この部品の60/11条件で解決したとはしない。
