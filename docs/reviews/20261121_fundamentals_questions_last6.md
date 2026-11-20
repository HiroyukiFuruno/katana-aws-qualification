# 基礎学習・後半6単元の設問内容レビュー

## 範囲と方法

`public/fundamentals/content.json` の index 6--11（最終問題72問）と、対応する `public/fundamentals/checkpoints.json` の checkpoint 24問、計96問を本文・例・誤解・要点と照合した。各問を実際に解き、本文だけで選択肢の真偽、極性、必要選択数、正答、解説を判断できるかを確認した。parse 成功や件数は良問の根拠にしていない。

レビュー時点の source hash:

- `public/fundamentals/content.json`: `332961193717ac32151fd24fbb36f255d78113e72c761e574a2cbd1d5fd6fc25`
- `public/fundamentals/checkpoints.json`: `95d4d43087142affef0d380674b73c5063051553f6c5da70572dc84560a13296`

ここでの「判断可」は本文から採点でき、正答 key と選択肢解説に矛盾を見つけなかったという意味である。外部一次資料の再調査はこの監査では行っていない。

## 要修正

### root原文照合後の採否

以下は公開原版の監査候補を残した記録であり、すべてのP2表現を必須修正として採用したわけではない。rootは必要条件が欠ける5件（NAT本文、testingの2 checkpoint、release中止閾値、SLO定義）と、最長prefixの本文、CI工程名の導入、`fund-cicd-004`の具体例、`fund-testing-012`の変更可能な共有データ、Golden Signalsの同じ文型による比較を採用した。

`fund-cicd-008`は単元内の別sectionで同一artifactの昇格を教えているため撤回。database-recovery checkpointは問題文の新旧同時稼働という前提から「旧版を即停止」を否定できるため撤回。残る「判断可だがP2」は本文で採点可能な初学者向けの反復・難易度改善候補であり、必須の内容不具合とは認定しない。正答キーや極性を取り違えて一律に改稿しない。

原版ID表と修正版の履歴は別々に保持し、修正・検証・公開の実績は`docs/plans/20261121_fundamentals_question_quality.md`へ記録する。

### P1: 本文にない知識を正答条件にする設問

- `fund-route-006`: 正答 D の「`NAT gatewayをpingできなければ`」と解説の「`NAT gatewayはpingへ応答しない`」は、`internet-egress` 本文が教える route と NAT の配置・IGW 条件にはない。本文へ ping を診断根拠にしない理由を追加するか、D を本文で扱う「private subnet の route と NAT 側 IGW route を確認しない」に置換する。
- `fundamentals.testing-quality.checkpoint.test-design.v1`: 正答 B は「`規則も固定する`」だけで、毎回変わる実行時刻を再現できない。選択肢を「入力時刻も記録して再投入し、その規則と期待値を固定する」に改め、本文の固定 input/記録へ接続する。
- `fundamentals.testing-quality.checkpoint.quality-gates.v1`: 問題文は「`必須条件`」とする一方、正答 C は「`型検査が失敗`」だけで、その型検査が必須 gate だと明記しない。C を「必須の型検査が失敗し、再現ログが保存されている」にするか、問題文で型検査を必須と指定する。
- `fundamentals.release-rollback.checkpoint.observation-abort.v1`: 「`baselineを超え、中止基準も事前に定義`」されたことと、実際に中止閾値を超えたことは別である。正答 D の停止判断を成立させるため、prompt を「事前の中止閾値を超えた」に変更する。
- `fundamentals.observability.checkpoint.objectives.v1`: 「SLOを定義する際、`必ず`」alert 設定まで要求する B は、SLO の分母・観測 window と alert 運用を混同する。prompt を「SLO と通知運用を設計する際」にするか、B を SLO 定義に必須の対象・成功条件へ置換する。

### P2: 判断を測りにくい、重複する、または正答が露骨な設問

- `fundamentals.routing-connectivity.checkpoint.route-selection.v1`: 本文は「CIDR の包含関係を確認」とは説明するが、「最長 prefix match でより具体的な route を選ぶ」を明示していない。本文へ選択規則を一文追加するか、checkpoint を包含判定だけにする。
- `fund-cicd-001`: 「`Source`」「`Deploy`」stage を本文が定義せず、本文は commit/build/test を起点にしている。選択肢を本文用語へ寄せるか、stage 用語を本文へ導入する。
- `fund-cicd-004`: 正答 C「`失敗してもdeployへ進める`」は `fund-cicd-001` の C と同じ停止判断で、objective と application が同じ。004 はログから原因を絞る具体例（失敗した test の識別、再実行条件）に変更する。
- `fund-cicd-008`: 誤答 E「`deliveryは毎回artifactを作り直す`」は、変更ごとの build と環境間の再 build を区別しないため曖昧である。「staging と production 用に別 artifact を再 build する」と具体化する。
- `fund-testing-012`: C「`失敗時のデータを共有したまま再実行`」は読み取り専用共有も含めてしまう。別 test が変更し得る同じデータを隔離せず再実行する、と具体化する。
- `fundamentals.release-rollback.checkpoint.database-recovery.v1`: A「`旧版を即停止`」は旧版停止自体が常に不正ではない。 「互換性を検証せず、破壊的変更の直後に旧版を停止する」として同時稼働の前提へ結び付ける。
- `fundamentals.observability.checkpoint.golden-signals.v1`: 正答は信号名なのに、誤答 B/C は「`断定する`」「`無視する`」という行為で文型が異なる。四つとも観測指標にそろえ、待ち時間と queue 増加から latency/saturation を選ばせる。

## 全IDの個別判定

### CIDR とサブネット（16問）

| ID | 判定 |
|---|---|
| fund-cidr-001 | 判断可。prefix と範囲の逆転を本文から否定できる。 |
| fund-cidr-002 | 判断可。/24 の4等分と /26 の64個が本文例にある。 |
| fund-cidr-101 | 判断可。二つの /26 が /25 相当になる説明と整合する。 |
| fund-cidr-102 | 判断可。AZ が違っても CIDR 重複不可という本文の誤解訂正に対応する。 |
| fund-cidr-103 | 判断可。既存 /25 に含まれる /26 を範囲で排除できる。 |
| fund-cidr-104 | 判断可。VPC 内包含と既存範囲非重複をまとめた判断である。 |
| fund-cidr-105 | 判断可。予約5個と見積りの二判断を本文から選べる。 |
| fund-cidr-106 | 判断可。/27 の不足と /26 の59 usable を計算できる。 |
| fund-cidr-107 | 判断可。106 と近いが、将来余地と見積り手順を問う別判断である。 |
| fund-cidr-108 | 判断可。public/private を経路で判断する本文と一致する。 |
| fund-cidr-109 | 判断可。経路、public IP、port/待受の診断順を本文例から判断できる。 |
| fund-cidr-110 | 判断可。CIDR だけの到達性判断と SG 不要論を否定できる。 |
| fundamentals.cidr-subnets.checkpoint.cidr.v1 | 判断可。/26 の64個と64刻みの境界に対応する。 |
| fundamentals.cidr-subnets.checkpoint.planning.v1 | 判断可。親 CIDR への包含と子 CIDR 非重複を確認できる。 |
| fundamentals.cidr-subnets.checkpoint.reserved.v1 | 判断可。/28 の16個から予約5個を引く判断である。 |
| fundamentals.cidr-subnets.checkpoint.public.v1 | 判断可。public IP 単独ではなく IGW route も必要と本文が説明する。 |

### ルーティングと接続（16問）

| ID | 判定 |
|---|---|
| fund-route-001 | 判断可。route の宛先 CIDR/prefix list と target の役割を問う。 |
| fund-route-002 | 判断可。送信元 route と相手側戻り route の両方を本文例で確認できる。 |
| fund-route-003 | 判断可。戻り route と target 側到達性を区別できる。 |
| fund-route-004 | 判断可。IGW、public IPv4/EIP、許可設定の条件を区別できる。 |
| fund-route-005 | 判断可。private 側発信の NAT 利用を本文例へ適用する。 |
| fund-route-006 | **P1**。NAT ping 非応答が本文未説明。上記修正が必要。 |
| fund-route-007 | 判断可。SG stateful と NACL stateless/subnet 単位を区別できる。 |
| fund-route-008 | 判断可。NACL の往復 rule と SG の独立評価を本文から否定できる。 |
| fund-route-009 | 判断可。route、NACL、SG の順序を問う。 |
| fund-route-010 | 判断可。名前解決、route/endpoint 条件、許可を別検査点にできる。 |
| fund-route-011 | 判断可。peering 後も両側 route と許可が必要である。 |
| fund-route-012 | 判断可。名前・送信 route が正しくても戻り route/許可を確認する。 |
| fundamentals.routing-connectivity.checkpoint.route-selection.v1 | **P2**。最長 prefix match が本文で明文化されない。 |
| fundamentals.routing-connectivity.checkpoint.internet-egress.v1 | 判断可。private route→NAT、NAT 側→internet の二段階を問う。 |
| fundamentals.routing-connectivity.checkpoint.traffic-controls.v1 | 判断可。SG の stateful 性を本文から選べる。 |
| fundamentals.routing-connectivity.checkpoint.private-paths.v1 | 判断可。名前解決後の route/NACL/戻り route を選べる。 |

### CI/CD（16問）

| ID | 判定 |
|---|---|
| fund-cicd-001 | **P2**。本文未定義の Source/Deploy stage 用語と、停止判断の露骨さを修正する。 |
| fund-cicd-002 | 判断可。失敗 build の続行と正常版を保持しない運用を本文から否定できる。 |
| fund-cicd-003 | 判断可。gate の定義と未達時停止を測る。 |
| fund-cicd-004 | **P2**。001 と同じ「失敗でも deploy」判断の反復。 |
| fund-cicd-005 | 判断可。CI 成功の限界と判断材料を区別できる。 |
| fund-cicd-006 | 判断可。delivery の配布可能状態と deployment の自動本番配布を区別する。 |
| fund-cicd-007 | 判断可。承認が test の代替でないことを問う。 |
| fund-cicd-008 | **P2**。E の「毎回再 build」は対象環境を明示せず曖昧。 |
| fund-cicd-009 | 判断可。同一 artifact と版/digest 記録を問う。 |
| fund-cicd-010 | 判断可。staging 検証済み digest を production でも確認する。 |
| fund-cicd-011 | 判断可。artifact の来歴を版/digest/commit/検査結果で追える。 |
| fund-cicd-012 | 判断可。stage ごとの条件、停止、正常版維持を統合している。 |
| fundamentals.cicd.checkpoint.continuous-integration.v1 | 判断可。小さい commit と早期原因特定を結ぶ。 |
| fundamentals.cicd.checkpoint.delivery-deployment.v1 | 判断可。承認後に反映可能な状態を delivery と区別する。 |
| fundamentals.cicd.checkpoint.artifacts-promotion.v1 | 判断可。digest 一致を同一 artifact の証跡にできる。 |
| fundamentals.cicd.checkpoint.quality-gates.v1 | 判断可。integration test 失敗で停止し、原因/再実行条件を記録する。 |

### テストと品質ゲート（16問）

| ID | 判定 |
|---|---|
| fund-testing-001 | 判断可だが P2。誤答の「常に」が定義 recall の正答を露呈する。 |
| fund-testing-002 | 判断可だが P2。003 とテスト層の選択判断が近い。 |
| fund-testing-003 | 判断可だが P2。002 と重複傾向。注文処理の層ごとの失敗原因まで問うとよい。 |
| fund-testing-004 | 判断可だが P2。3択中2誤答が極端で、固定 input/期待値の判断が浅い。 |
| fund-testing-005 | 判断可だが P2。無記録/境界値省略が露骨な誤答である。 |
| fund-testing-006 | 判断可。1000円・10%・境界値の固定入力を具体的に適用できる。 |
| fund-testing-007 | 判断可だが P2。実行だけ/結果削除という極端な対比を実務上の候補へ替える余地がある。 |
| fund-testing-008 | 判断可だが P2。失敗無視して配布する誤答が自明である。 |
| fund-testing-009 | 判断可だが P2。報告保存の選択肢が重なり、独立した判断価値が薄い。 |
| fund-testing-010 | 判断可だが P2。入力・期待値・実結果・commit の記録を一つの具体的失敗へ結び付けるとよい。 |
| fund-testing-011 | 判断可だが P2。010/012 と失敗後調査の判断を反復している。 |
| fund-testing-012 | **P2**。共有データの範囲が曖昧。変更し得る共有データと明記する。 |
| fundamentals.testing-quality.checkpoint.test-levels.v1 | 判断可だが P2。代替の lint/画像だけが露骨で、実境界の理由を具体化できる。 |
| fundamentals.testing-quality.checkpoint.test-design.v1 | **P1**。時刻そのものを再現条件に含めない。 |
| fundamentals.testing-quality.checkpoint.quality-gates.v1 | **P1**。型検査が必須 gate か不明。 |
| fundamentals.testing-quality.checkpoint.failure-regression.v1 | 判断可だが P2。ログ削除のような極端な誤答を、誤った層での回帰追加等へ置換する。 |

### デプロイと復旧（16問）

| ID | 判定 |
|---|---|
| fund-release-001 | 判断可。canary の定義 recall である。 |
| fund-release-002 | 判断可。blue/green の費用と canary の少量観測を区別する。 |
| fund-release-003 | 判断可だが P2。002 と方式選択が近い。停止許容時間・費用を与えて比較させる。 |
| fund-release-004 | 判断可だが P2。3択中2誤答が露骨で、観測値と停止基準の関係を具体化できる。 |
| fund-release-005 | 判断可だが P2。004 と同じ監視欠落/閾値超過の判断を反復する。 |
| fund-release-006 | 判断可だが P2。004/005 と近い。閾値、待機時間、観測不能の優先順位を固定する。 |
| fund-release-007 | 判断可。rollback、rollforward、DB 復元を区別できる。 |
| fund-release-008 | 判断可だが P2。「確認せず完了」が露骨な誤答である。 |
| fund-release-009 | 判断可だが P2。「必ず」「不明でも」「確認不要」が正答を露呈する。 |
| fund-release-010 | 判断可だが P2。本文の列削除例に近く、互換性を別の migration 例で適用させたい。 |
| fund-release-011 | 判断可。rollback と DB 復元、RTO/RPO を区別する。 |
| fund-release-012 | 判断可だが P2。010/011 の旧版互換・データ復旧の言い換え傾向がある。 |
| fundamentals.release-rollback.checkpoint.deployment-strategies.v1 | 判断可だが P2。backup が領域違いの自明な誤答である。 |
| fundamentals.release-rollback.checkpoint.observation-abort.v1 | **P1**。baseline 超過だけでは中止閾値超過を意味しない。 |
| fundamentals.release-rollback.checkpoint.rollback-recovery.v1 | 判断可だが P2。「DB を直接削除」「監視を止める」が極端である。 |
| fundamentals.release-rollback.checkpoint.database-recovery.v1 | **P2**。旧版停止を無条件に不正と読める。互換性未検証の破壊的変更へ具体化する。 |

### 監視と改善（16問）

| ID | 判定 |
|---|---|
| fund-observe-101 | 判断可。metrics/logs/traces の基本的な役割を区別する recall。 |
| fund-observe-102 | 判断可だが P2。checkpoint.signals と遅い単一要求→trace の判断が重複する。 |
| fund-observe-103 | 判断可だが P2。「だけ」が誤答を露呈する。metric から log/trace を選ぶ具体的症状にする。 |
| fund-observe-104 | 判断可だが P2。saturation と HTTP 成功率を混同する誤答が露骨である。 |
| fund-observe-105 | 判断可だが P2。CPU/5xx の相関を因果と断定しない判断は112と重複する。 |
| fund-observe-106 | 判断可だが P2。「必ず」「必要ない」「無関係」が選択肢の真偽を露呈する。 |
| fund-observe-107 | 判断可だが P2。分母未定義という極端な誤答を、対象に含める/除外する具体例に替える。 |
| fund-observe-108 | 判断可だが P2。「常に正常」が無データと正常の区別を露呈する。 |
| fund-observe-109 | 判断可だが P2。絶対表現を避け、観測 window と通知行動の具体例で比較する。 |
| fund-observe-110 | 判断可だが P2。二つの誤答がいずれも相関からの仮説固定に寄っている。 |
| fund-observe-111 | 判断可。同条件比較、trace/log、影響限定を本文例から適用できる。 |
| fund-observe-112 | 判断可だが P2。105 と因果断定・観測 window 比較の判断が重複する。 |
| fundamentals.observability.checkpoint.signals.v1 | 判断可だが P2。102 と trace の用途を復唱している。 |
| fundamentals.observability.checkpoint.golden-signals.v1 | **P2**。正答だけが信号名で、誤答の文型が異なる。 |
| fundamentals.observability.checkpoint.objectives.v1 | **P1**。SLO 定義へ alert 運用を過剰に必須化している。 |
| fundamentals.observability.checkpoint.improvement.v1 | 判断可だが P2。「metric を削除」が自明な誤答。比較条件の違いを問う。 |

## 結論

96問すべてについて、正答 key の明白な逆転や選択数との矛盾は発見しなかった。一方で P1 の5問は、本文にない診断知識、必要条件の欠落、または SLO と alert 運用の混同のため、内容修正なしに学習済み本文からの判断を主張できない。P2 は、誤答の極端さと同じ判断の反復を減らして、状況・条件・優先順位の比較へ改稿する候補である。修正はこの監査では行っていない。


## 採点契約の原本照合（全96問）

下表は公開 JSON の `selectionPolarity`、`requiredChoices`、`correct` をそのまま転記した。上の内容判定とは独立に、極性と正答数・key を取り違えていないことを確認するための照合表である。

| 単元 | ID | 極性 | 必要選択数 | 正答 key |
|---|---|---:|---:|---|
| fundamentals.cidr-subnets | `fund-cidr-001` | correct | 1 | A |
| fundamentals.cidr-subnets | `fund-cidr-002` | correct | 1 | B |
| fundamentals.cidr-subnets | `fund-cidr-101` | incorrect | 1 | C |
| fundamentals.cidr-subnets | `fund-cidr-102` | incorrect | 1 | B |
| fundamentals.cidr-subnets | `fund-cidr-103` | incorrect | 1 | A |
| fundamentals.cidr-subnets | `fund-cidr-104` | correct | 1 | A |
| fundamentals.cidr-subnets | `fund-cidr-105` | correct | 2 | B,E |
| fundamentals.cidr-subnets | `fund-cidr-106` | correct | 2 | A,C |
| fundamentals.cidr-subnets | `fund-cidr-107` | correct | 2 | B,D |
| fundamentals.cidr-subnets | `fund-cidr-108` | incorrect | 2 | A,E |
| fundamentals.cidr-subnets | `fund-cidr-109` | incorrect | 2 | B,D |
| fundamentals.cidr-subnets | `fund-cidr-110` | incorrect | 2 | C,E |
| fundamentals.cidr-subnets | `fundamentals.cidr-subnets.checkpoint.cidr.v1` | correct | 1 | C |
| fundamentals.cidr-subnets | `fundamentals.cidr-subnets.checkpoint.planning.v1` | correct | 1 | D |
| fundamentals.cidr-subnets | `fundamentals.cidr-subnets.checkpoint.reserved.v1` | correct | 1 | A |
| fundamentals.cidr-subnets | `fundamentals.cidr-subnets.checkpoint.public.v1` | correct | 1 | B |
| fundamentals.routing-connectivity | `fund-route-001` | correct | 1 | A |
| fundamentals.routing-connectivity | `fund-route-002` | incorrect | 1 | C |
| fundamentals.routing-connectivity | `fund-route-003` | correct | 2 | A,D |
| fundamentals.routing-connectivity | `fund-route-004` | incorrect | 2 | C,E |
| fundamentals.routing-connectivity | `fund-route-005` | correct | 1 | B |
| fundamentals.routing-connectivity | `fund-route-006` | incorrect | 1 | D |
| fundamentals.routing-connectivity | `fund-route-007` | correct | 2 | A,C |
| fundamentals.routing-connectivity | `fund-route-008` | incorrect | 2 | B,D |
| fundamentals.routing-connectivity | `fund-route-009` | correct | 1 | C |
| fundamentals.routing-connectivity | `fund-route-010` | incorrect | 1 | B |
| fundamentals.routing-connectivity | `fund-route-011` | correct | 2 | A,E |
| fundamentals.routing-connectivity | `fund-route-012` | incorrect | 2 | B,D |
| fundamentals.routing-connectivity | `fundamentals.routing-connectivity.checkpoint.route-selection.v1` | correct | 1 | C |
| fundamentals.routing-connectivity | `fundamentals.routing-connectivity.checkpoint.internet-egress.v1` | correct | 2 | C,D |
| fundamentals.routing-connectivity | `fundamentals.routing-connectivity.checkpoint.traffic-controls.v1` | correct | 1 | D |
| fundamentals.routing-connectivity | `fundamentals.routing-connectivity.checkpoint.private-paths.v1` | correct | 1 | A |
| fundamentals.cicd | `fund-cicd-001` | incorrect | 1 | C |
| fundamentals.cicd | `fund-cicd-002` | incorrect | 2 | B,C |
| fundamentals.cicd | `fund-cicd-003` | correct | 1 | A |
| fundamentals.cicd | `fund-cicd-004` | incorrect | 1 | C |
| fundamentals.cicd | `fund-cicd-005` | correct | 2 | A,C |
| fundamentals.cicd | `fund-cicd-006` | correct | 1 | B |
| fundamentals.cicd | `fund-cicd-007` | incorrect | 1 | C |
| fundamentals.cicd | `fund-cicd-008` | correct | 2 | A,D |
| fundamentals.cicd | `fund-cicd-009` | incorrect | 2 | B,C |
| fundamentals.cicd | `fund-cicd-010` | correct | 1 | A |
| fundamentals.cicd | `fund-cicd-011` | correct | 2 | A,C |
| fundamentals.cicd | `fund-cicd-012` | incorrect | 2 | B,D |
| fundamentals.cicd | `fundamentals.cicd.checkpoint.continuous-integration.v1` | correct | 1 | B |
| fundamentals.cicd | `fundamentals.cicd.checkpoint.delivery-deployment.v1` | correct | 1 | C |
| fundamentals.cicd | `fundamentals.cicd.checkpoint.artifacts-promotion.v1` | correct | 1 | D |
| fundamentals.cicd | `fundamentals.cicd.checkpoint.quality-gates.v1` | correct | 2 | D,A |
| fundamentals.testing-quality | `fund-testing-001` | correct | 1 | A |
| fundamentals.testing-quality | `fund-testing-002` | incorrect | 1 | C |
| fundamentals.testing-quality | `fund-testing-003` | correct | 2 | A,D |
| fundamentals.testing-quality | `fund-testing-004` | correct | 2 | A,C |
| fundamentals.testing-quality | `fund-testing-005` | incorrect | 2 | B,C |
| fundamentals.testing-quality | `fund-testing-006` | correct | 2 | A,C |
| fundamentals.testing-quality | `fund-testing-007` | correct | 1 | A |
| fundamentals.testing-quality | `fund-testing-008` | incorrect | 1 | C |
| fundamentals.testing-quality | `fund-testing-009` | incorrect | 2 | B,C |
| fundamentals.testing-quality | `fund-testing-010` | correct | 1 | A |
| fundamentals.testing-quality | `fund-testing-011` | incorrect | 1 | C |
| fundamentals.testing-quality | `fund-testing-012` | incorrect | 2 | B,C |
| fundamentals.testing-quality | `fundamentals.testing-quality.checkpoint.test-levels.v1` | correct | 1 | A |
| fundamentals.testing-quality | `fundamentals.testing-quality.checkpoint.test-design.v1` | correct | 2 | A,B |
| fundamentals.testing-quality | `fundamentals.testing-quality.checkpoint.quality-gates.v1` | correct | 2 | B,C |
| fundamentals.testing-quality | `fundamentals.testing-quality.checkpoint.failure-regression.v1` | correct | 1 | B |
| fundamentals.release-rollback | `fund-release-001` | correct | 1 | A |
| fundamentals.release-rollback | `fund-release-002` | incorrect | 1 | C |
| fundamentals.release-rollback | `fund-release-003` | correct | 2 | A,D |
| fundamentals.release-rollback | `fund-release-004` | correct | 2 | A,C |
| fundamentals.release-rollback | `fund-release-005` | incorrect | 2 | B,C |
| fundamentals.release-rollback | `fund-release-006` | incorrect | 2 | B,E |
| fundamentals.release-rollback | `fund-release-007` | correct | 1 | A |
| fundamentals.release-rollback | `fund-release-008` | incorrect | 1 | C |
| fundamentals.release-rollback | `fund-release-009` | correct | 2 | A,D |
| fundamentals.release-rollback | `fund-release-010` | correct | 1 | A |
| fundamentals.release-rollback | `fund-release-011` | incorrect | 1 | B |
| fundamentals.release-rollback | `fund-release-012` | incorrect | 2 | B,E |
| fundamentals.release-rollback | `fundamentals.release-rollback.checkpoint.deployment-strategies.v1` | correct | 1 | C |
| fundamentals.release-rollback | `fundamentals.release-rollback.checkpoint.observation-abort.v1` | correct | 1 | D |
| fundamentals.release-rollback | `fundamentals.release-rollback.checkpoint.rollback-recovery.v1` | correct | 1 | A |
| fundamentals.release-rollback | `fundamentals.release-rollback.checkpoint.database-recovery.v1` | correct | 2 | C,D |
| fundamentals.observability | `fund-observe-101` | correct | 1 | A |
| fundamentals.observability | `fund-observe-102` | correct | 1 | B |
| fundamentals.observability | `fund-observe-103` | correct | 1 | C |
| fundamentals.observability | `fund-observe-104` | incorrect | 1 | D |
| fundamentals.observability | `fund-observe-105` | incorrect | 1 | A |
| fundamentals.observability | `fund-observe-106` | correct | 2 | B,E |
| fundamentals.observability | `fund-observe-107` | correct | 2 | A,B |
| fundamentals.observability | `fund-observe-108` | incorrect | 1 | B |
| fundamentals.observability | `fund-observe-109` | correct | 2 | A,D |
| fundamentals.observability | `fund-observe-110` | incorrect | 2 | B,E |
| fundamentals.observability | `fund-observe-111` | incorrect | 2 | A,D |
| fundamentals.observability | `fund-observe-112` | incorrect | 2 | C,E |
| fundamentals.observability | `fundamentals.observability.checkpoint.signals.v1` | correct | 1 | B |
| fundamentals.observability | `fundamentals.observability.checkpoint.golden-signals.v1` | correct | 2 | D,A |
| fundamentals.observability | `fundamentals.observability.checkpoint.objectives.v1` | correct | 2 | A,B |
| fundamentals.observability | `fundamentals.observability.checkpoint.improvement.v1` | correct | 1 | C |
