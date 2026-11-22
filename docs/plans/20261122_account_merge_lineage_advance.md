# #58 lineage advance source contract

`advance_merge_lineage(receipt, source, canonical)` は、callerがfresh dual proof、ordered locks、
data-engine、membership移動、source retire/fenceを完了した後だけ呼ぶprivate helperである。
account/membershipの移動・retire・fenceはこのhelperの責務ではない。

sourceの12公開表とmembershipが空、source/過去ancestorがretired、canonicalがactiveかつstateあり、
receipt/intents/before_scopesのpairが一致することをfail-closedで検証する。sourceが以前の
canonicalなら、そのretired ancestor closureもcurrent canonicalへ進める。closureの
`established_receipt_id` は最初にancestorを確立したreceiptを保持し、currentだけを進める。

receipt、archive、id-map、receipt resultは更新しない。同receiptの再送はclosureを読んで同じ
canonicalを返すだけであり、後続C→Dの後に旧A→B receiptを再送してもcurrentをC/Bへ戻さない。
snapshot v2はcurrent canonicalに連なる全retired ancestorと不変receipt/archive/mapを含む。

runnerはunregistered private helperをengineと同じstdin経路で導入する。native component fixtureは
実OAuth actorとrollback transactionだけを使い、A→B→C、public残存、active ancestor、cycle、
foreign scope、missing/NULL、digest drift、raw archive不変を検証して接続する予定である。
