# Routing・テスト・デプロイ復旧・Observability 内容レビュー

レビュー日: 2026-11-20  
対象: `routing-connectivity.json`, `testing-quality.json`, `release-rollback.json`, `observability.json`  
方針: 対象JSONは変更せず、全48問を本文から実際に解答し、promptの極性/必要数、正答key、全選択肢の事実と解説を照合した。AWS公式資料・RFCの定義と、IT/E2Eで実境界を確認するrepo要件も確認した。

## 判定

- **P0**: promptどおりに解くと正答が反転、または単一/複数選択が成立しない。
- **P1**: 本文と設問の判断が矛盾し、誤った運用を学ぶ。
- **P2**: 実質重複、説明不足、用語根拠不足だが正答自体は判断可能。
- **OK**: 本文、極性、選択数、正答、選択肢解説が整合。

## routing-connectivity

4目標（route選択、IGW/NAT、SG/NACL、private経路）と4sectionが対応し、本文には宛先CIDR、戻りroute、NAT二段階、stateful/stateless、DNS→route→許可の切り分けがある。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-route-001 | A | **OK**。routeは宛先CIDR/prefix listとtargetの対応。 |
| fund-route-002 | C | **OK**。peeringは相手側の戻りrouteも必要で、片側defaultだけを見ない。 |
| fund-route-003 | A,D | **OK**。戻りrouteとtarget側設定が不足し得る。B/C/Eの説明も本文と整合。 |
| fund-route-004 | C,E | **OK**。NATをprivate subnetに置くだけ、private IPだけでは外部到達しない。 |
| fund-route-005 | B | **OK**。NATはprivateから外部への発信出口で、直接着信ではない。 |
| fund-route-006 | D | **OK**。NAT gatewayは通常ping応答を前提にせず、状態/route/許可を確認する。 |
| fund-route-007 | A,C | **OK**。SGはstateful、NACLはsubnet単位・statelessで両方向を扱う。 |
| fund-route-008 | B,D | **OK**。SGのstateful性はNACLのoutbound不要を意味せず、ALB/EC2両subnetのNACLを確認する。 |
| fund-route-009 | C | **OK**。route→NACL→SGの境界順に確認する。 |
| fund-route-010 | B | **OK**。DNS成功だけでroute/許可を省略できない。 |
| fund-route-011 | A,E | **OK**。peering後も両VPC routeとSG/NACL許可が必要。 |
| fund-route-012 | B,D | **OK**。DNS/送信routeが正しくてもfilter拒否はあり、全開放は不適切。 |

routing-connectivityにP0/P1/P2はない。各問の正答と全選択肢解説は本文の層別切り分けに沿っている。

## testing-quality

4目標（テスト粒度、再現可能な入力/期待値、品質gate、失敗調査/回帰）と4sectionが対応する。unitのmockとIT/E2Eの実境界検証を区別しており、repo要件にも抵触しない。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-testing-001 | A | **OK**。unit=小単位、integration=境界、E2E=利用経路。 |
| fund-testing-002 | C | **OK**。E2Eだけで各関数の原因を十分に特定するのは誤り。 |
| fund-testing-003 | A,D | **OK**。局所規則/境界/重要利用経路を粒度別に確認する。 |
| fund-testing-004 | A,C | **OK**。固定入力・仕様期待値と、失敗時の入力/実結果記録。 |
| fund-testing-005 | B,C | **OK**。外部API変動の放置、境界/異常系の期待値未定義が誤り。 |
| fund-testing-006 | A,C | **OK**。具体的な期待値と境界ケース。B/D/Eは本文の再現性・実境界要件に反する。 |
| fund-testing-007 | A | **OK**。gateは合格基準を満たさない変更を止める。 |
| fund-testing-008 | C | **OK**。重要E2Eが遅くても失敗を無視して配布しない。 |
| fund-testing-009 | B,C | **P0**。promptは誤りを2つ問うが、Eも「テスト失敗でも後段へ自動promotion」で誤り。誤りがB,C,Eの3つあり、correct/requiredChoices=2で成立しない。**修正案**: Eを正しい文へ変更するか、correctを[B,C,E]・requiredChoices=3へ変更。 |
| fund-testing-010 | A | **OK**。入力、期待値、実結果、ログ、commitを固定して再現する。 |
| fund-testing-011 | C | **OK**。修正後も回帰テストを追加しないのは誤り。 |
| fund-testing-012 | B,C | **P0**。promptは誤りを2つ問うが、Eも「閾値を下げて失敗を消すことを再発防止と呼ぶ」で誤り。B,C,Eの3つが誤り。**修正案**: Eを正しい文へ変更するか、correctを[B,C,E]・requiredChoices=3へ変更。 |

### testing追加指摘

- `fund-testing-009` と `fund-testing-012` は本文内容自体は正しいが、誤り選択肢を3つ置いたため単一の正答集合契約と不一致。
- それ以外は、選択肢数が3/5でもrequiredChoicesとcorrectが一致し、本文から解答できる。設問間の判断も、粒度、再現性、gate、回帰で分離されている。

## release-rollback

4目標（rolling/blue-green/canary、観測/中止、rollback/rollforward、DB互換性/復旧）と4sectionが対応する。コードrollbackだけでデータは戻らないこと、backup/restoreと互換性を別設計することも本文にある。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-release-001 | A | **OK**。canaryは少量trafficから段階拡大。 |
| fund-release-002 | C | **OK**。rollingには新旧共存期間がある。 |
| fund-release-003 | A,D | **OK**。blue/greenの二重費用とcanaryの段階/待機/停止条件を考える。 |
| fund-release-004 | A,C | **P0**。promptは「正しいものを2つ」だがCは「問題があっても予定時刻までtrafficを増やす」で誤り。正しいのはAのみで、requiredChoices=2/correct=[A,C]が不一致。**修正案**: Cを「問題があればtraffic拡大を止める」等の正しい選択肢へ反転しない文に直す。 |
| fund-release-005 | B,C | **OK**。観測欠落で拡大、閾値超過でも証跡なし続行が誤り。 |
| fund-release-006 | B,E | **OK**。業務指標悪化の無視、未観測を正常扱いするのが誤り。 |
| fund-release-007 | A | **OK**。rollback=既知正常版、rollforward=修正版revision。DB状態は自動復元しない。 |
| fund-release-008 | C | **OK**。rollback実行だけで完了扱いせず、health/業務/整合性を確認する。 |
| fund-release-009 | A,D | **OK**。影響停止と、原因判明後の安全なrollforward。 |
| fund-release-010 | A | **OK**。追加→コード切替→旧形式削除を分離し、新旧共存期間を設ける。 |
| fund-release-011 | B | **OK**。破壊的migration後のコードrollbackだけでは過去データに戻らない。 |
| fund-release-012 | B,E | **OK**。旧版非互換の即時変更、コードだけでデータ復元という誤り。 |

### release追加指摘

- **P0 `fund-release-004`**: correct集合に誤ったCが混在し、正しい選択肢が1つしかない。中止基準を問う本文との整合を保つにはCの文を修正する。
- その他は、本文の展開方式・観測・復旧・DB互換性から正答を導ける。DB破壊後のコードrollback万能という誤解は発生していない。

## observability

4目標（metrics/logs/traces、latency/errors/traffic/saturation、SLI/SLO/alert、仮説検証）と4sectionが対応する。本文は分子/分母、観測窓、無データ、相関と因果の区別、変更前後比較まで説明している。

| ID | 回答 | 判定・照合 |
|---|---|---|
| fund-observe-101 | A | **OK**。metricは時間比較する数値。 |
| fund-observe-102 | B | **OK**。個別要求の下流経路と時間はtrace。 |
| fund-observe-103 | C | **OK**。metricで異常時刻、log/traceで対象と経路を絞る。 |
| fund-observe-104 | D | **OK**。saturationは資源/処理能力の余力でありHTTP成功率ではない。 |
| fund-observe-105 | A | **OK**。CPU高と5xx同時発生は相関であり、原因確定せず追加観測する。 |
| fund-observe-106 | B,E | **OK**。対象/期間を固定してp95、traffic/saturationも比較する。 |
| fund-observe-107 | A,B | **OK**。SLIの分子=成功対象、分母=対象要求。 |
| fund-observe-108 | B | **OK**。無データを常に正常扱いせず、要求ゼロと計測停止を分ける。 |
| fund-observe-109 | A,D | **OK**。SLOの閾値/目標/窓、alertの無データ/行動手順を定義する。 |
| fund-observe-110 | B,E | **OK**。相関を因果確定、反証を無視するのが誤り。 |
| fund-observe-111 | A,D | **OK**。CPUだけで改善確定、相関だけで全環境一括変更は誤り。 |
| fund-observe-112 | C,E | **OK**。CPUだけを唯一原因と断定、観測窓を変えて比較するのが誤り。 |

observabilityにP0/P1/P2指摘はない。metric/log/trace、golden signals、SLI/SLO/alert、仮説検証の説明と設問は整合している。

## 共通確認

4単元とも4目標・4section・12問で、参照先、全選択肢解説、公式https source、learning.reason/conceptは存在する。形式分布は各単元で正しい1/誤り1/正しい複数/誤り複数が各3問。ただし件数やparse成功は内容正しさの証拠ではなく、上記P0を修正してから全問を再解答する必要がある。

## 修正依頼一覧

1. **P0 `fund-testing-009`**: 誤りがB,C,Eの3つなのにrequiredChoices=2/correct=[B,C]。
2. **P0 `fund-testing-012`**: 誤りがB,C,Eの3つなのにrequiredChoices=2/correct=[B,C]。
3. **P0 `fund-release-004`**: 正しい選択肢がAのみなのにcorrect=[A,C]/requiredChoices=2。Cの文を修正する。

## source hash

レビュー時点の対象JSON sha256（rootが修正後に更新すること）:

```text
9b33450ca45e3db09473acc810944c3e2a5390fbcb231701324072ad883ff7cf  docs/fundamentals-drafts/routing-connectivity.json
2888d514fe93ff3ec7c534dee56cc48be186736dd188aadab3c142e3a86eeaba  docs/fundamentals-drafts/testing-quality.json
c04eca7522da9a837eb8dc7fbce2e08cb0bb633e4c5f68ed59a08fbf393392f7  docs/fundamentals-drafts/release-rollback.json
ceef4866a79c10c779ff4b43673082d39931fb2dfea0f7dad0473acdc6c9015a  docs/fundamentals-drafts/observability.json
```
