# Cloud Concepts・CI/CD 内容レビュー

レビュー日: 2026-11-20  
対象: `cloud-concepts.json`, `cicd.json`  
方針: 対象JSONは変更せず、全24問を本文から実際に解答し、promptの極性/必要数、全選択肢の事実、`correct`、各解説を照合した。件数/parse結果は内容正しさの根拠にしていない。

## 判定

- **P0**: promptどおりに解くと正答が反転、または単一/複数選択が成立しない。
- **P1**: 本文と設問の判断が矛盾し、誤った運用を学ぶ。
- **P2**: 実質重複、説明不足、本文根拠不足だが正答自体は判断可能。
- **OK**: 本文、極性、選択数、正答、選択肢解説が整合。

## cloud-concepts

4目標はon-demand/従量課金、責任共有、Region/AZ、負荷・障害・費用の比較に対応する。各sectionに用語の定義、因果、判断手順、具体例、誤解、要点があり、AWSのクラウド概要・責任共有・Region/AZの公式資料の説明と整合する。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-cloud-101 | A | **OK**。オンデマンドは必要時に資源を要求し、利用状況で見直す。 |
| fund-cloud-102 | B | **OK**。計算停止は残したディスク/データの料金を消さない。 |
| fund-cloud-103 | A,B | **OK**。平常量を測り、ピーク後に計算容量を減らす。C/D/Eの否定理由も本文にある。 |
| fund-cloud-001 | B | **OK**。物理施設の安全管理はAWS、公開範囲/ゲストOSは利用者。 |
| fund-cloud-105 | C | **OK**。EC2ゲストOS更新をAWS任せにするのは誤り。 |
| fund-cloud-106 | C,D | **OK**。マネージドでも利用者設定は残り、ゲストOSと物理設備の担当は異なる。 |
| fund-cloud-002 | B | **OK**。AZはRegion内の分離拠点であり、Regionをまたぐ地理単位ではない。 |
| fund-cloud-108 | A,B | **OK**。同一AZでは個別故障に備え得るが、AZ全体障害は共有する。 |
| fund-cloud-109 | C,D | **OK**。配置分散後も残存capacityと別Region複製を自動とみなしてはいけない。 |
| fund-cloud-110 | A | **OK**。可用性設計の出発点は停止時の影響と許容待ち時間。 |
| fund-cloud-111 | A,B | **OK**。性能は処理量/能力、障害耐性は配置/依存先で評価する。 |
| fund-cloud-112 | B,C | **OK**。容量増加はAZ障害を自動解消せず、複数AZにも費用/運用負担がある。 |

cloud-conceptsの24問中12問は本文で定義した判断を順に確認し、実質的な正答重複や単一選択の複数正答は見つからなかった。各選択肢の説明も正答/誤答の理由を具体化している。

## cicd

4目標はCI、delivery/deploymentと承認、artifact同一性、品質gateと段階promotionに対応する。cicd-003/005/010は修正後の本文・matrixに照らして再確認した。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-cicd-001 | C | **OK**。deployはtest結果に無関係に必ず本番へ送らず、gate/承認で止める。 |
| fund-cicd-002 | B,C | **OK**。失敗buildのdeploy継続、正常版を保持しないことが誤り。 |
| fund-cicd-003 | A | **OK（修正済み）**。quality gateは次段階の条件を検査し、未達なら停止する。cicd-4とsectionも一致。 |
| fund-cicd-004 | C | **OK**。CI失敗を後段へ流さず、ログ調査・修正・再実行する。 |
| fund-cicd-005 | A,C | **OK（修正済み）**。CIのintegrateとして、変更が小さいうちの検出とbuild/test結果の利用を問う。cicd-1とsectionが一致。 |
| fund-cicd-006 | B | **OK**。continuous deploymentは検査後の本番配布まで自動化し、deliveryは配布可能状態。 |
| fund-cicd-007 | C | **OK**。承認はtestの代替ではない。 |
| fund-cicd-008 | A,D | **OK**。deliveryの状態と承認による影響/監視確認を区別する。 |
| fund-cicd-009 | B,C | **OK**。環境ごとの再build、版/digest未記録がartifact promotionの誤り。 |
| fund-cicd-010 | A | **OK（修正済み）**。設定を外部注入してもartifactの版/digest識別は必要で、Cは明確な誤り。 |
| fund-cicd-011 | A,C | **OK**。版/digestと生成元commit/検査結果を記録する。 |
| fund-cicd-012 | B,D | **OK**。gate失敗の続行と閾値引下げが誤り。 |

cicdの修正3問を含む12問は、本文で説明された判断と正答が一致し、単一選択で複数の正しい選択肢は見つからなかった。artifact問題では、外部設定と実行物同一性を混同していない。

## 形式・matrixの確認

両単元とも全設問の `objectiveId`/`sectionId` が対応する本文sectionを指し、全選択肢にexplanation、https source、learning.reason/conceptがある。各単元の形式分布は正しい1/誤り1/正しい複数/誤り複数が各3問で、recall/apply/integrateも各4問。ただしこれは内容照合の補助情報であり、レビューの代替にはしていない。

## 指摘

今回の24問にP0/P1/P2指摘はない。cloud-concepts/cicdとも、本文→prompt極性→選択数→correct→選択肢事実→解説の順で再確認済み。

## source hash

レビュー時点の対象JSON sha256（rootが再統合後に更新すること）:

```text
14cbe2d3cb215fb9d64bc07e5a4021139762b60812f8885b0e451c8803dda084  docs/fundamentals-drafts/cloud-concepts.json
96c1200ef527d1b0ac354c6c366146a7865d7bb6942284c730e7beecbc8cd64e  docs/fundamentals-drafts/cicd.json
```
