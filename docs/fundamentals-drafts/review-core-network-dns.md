# 主要サービス・通信・DNS 教材内容レビュー

レビュー日: 2026-11-20  
対象: `core-services.json`, `networking-basics.json`, `domain-dns.json`  
方針: 対象JSONは変更せず、各設問を本文から実際に解答し、promptの極性/個数、`correct`、選択肢の事実と全解説を照合した。AWS公式資料および必要なRFCの定義も確認した。

## 判定

- **P0**: 正答が反転し、設問どおりに解くと誤った判断を学ぶ。
- **P1**: promptとmetadataが矛盾、または正答が複数になり設問として成立しない。
- **P2**: 重複や説明不足だが、正答自体は判断できる。
- **OK**: 本文、極性、選択数、正答、解説が整合。

## core-services

4目標はcompute（EC2/Lambda）、storage（S3/EBS）、database（RDS/DynamoDB）、composition（要件分解）に対応する。各本文sectionに用語、選定手順、具体例、misconception、takeawaysがあり、設問の正答を本文から導ける。

| ID | 回答照合 | 判定 |
|---|---|---|
| fund-services-001 | A | **OK**。EC2はOS/アプリを利用者が管理する仮想サーバー。 |
| fund-services-002 | B | **OK**。S3到着イベントで短い処理を起動するLambdaが本文の判断に一致。 |
| fund-services-101 | A | **OK**。常駐ソフトとOSパッチ管理の要件からEC2を比較する。 |
| fund-services-102 | B | **OK**。EC2接続ブロックデバイスはEBSでありS3ではない。 |
| fund-services-103 | A | **OK**。OSの接続ディスク用途でS3だけを選ぶのは誤り。 |
| fund-services-104 | C | **OK**。IAMは保存先でなくアクセス制御。 |
| fund-services-105 | A,D | **OK**。RDSは関係/SQL、DynamoDBはキー中心のアクセス設計。 |
| fund-services-106 | B,E | **OK**。結合・集計を要件化し、RDSと検索/整合性を比較する。 |
| fund-services-107 | A,C | **OK**。DynamoDBではアクセスキーと必要な問い合わせを先に照合する。 |
| fund-services-108 | B,D | **OK**。IAMを保存先にすること、EC2選択だけでDB検索を無視することが誤り。 |
| fund-services-109 | A,E | **OK**。IAMポリシーへの保存、S3でOS常駐実行はいずれも誤り。 |
| fund-services-110 | C,D | **OK**。サービス名先行と1サービスへの全責務集中が誤り。 |

core-servicesにP0/P1/P2指摘はない。各選択肢の解説も正答/誤答の理由を説明している。

## networking-basics

4目標はIP/port、TCP/UDP、HTTP/TLS、段階的診断に対応する。本文はDNS→経路→port→TCP/UDP→TLS→HTTPの切り分け順を示している。

| ID | 回答照合 | 判定 |
|---|---|---|
| fund-network-001 | A | **OK**。IPはネットワーク上の宛先、portはサービス識別。 |
| fund-network-002 | B | **OK**。HTTPSの同一IP上のサービスは443番portの許可/待受を確認する。 |
| fund-network-101 | C | **OK**。IPだけではport許可/待受を保証しない。 |
| fund-network-102 | B | **OK**。TCPは接続、順序、到達を扱うため「まったく扱わない」は誤り。 |
| fund-network-103 | A | **P0**。promptは「正しい判断」を問うが、`selectionPolarity=incorrect`かつcorrect=A。AはUDPの誤った説明で、promptどおりの正答ではない。さらにBとCはともに正しい判断なのでrequiredChoices=1も成立しない。**修正案**: promptを「誤っているもの」にするならAを正答にできるが、本文のintegrate目標に合わせるならpromptを「正しい判断を2つ」に変更しcorrect=[B,C]・requiredChoices=2・polarity=correctが自然。 |
| fund-network-104 | A | **OK**。順序、到達、再送をどこで扱うかを出発点にする。 |
| fund-network-105 | B,E | **OK**。HTTPは要求/応答、TLSは機密性/完全性。 |
| fund-network-106 | A,C | **OK**。証明書/hostnameとTCP/443という前段を分けて確認する。 |
| fund-network-107 | B,D | **OK**。TCP→TLS→HTTPを分け、404はHTTP段階として扱う。 |
| fund-network-108 | A,E | **OK**。DNS失敗で再deploy、原因不明で全port開放はいずれも誤り。 |
| fund-network-109 | B,D | **P0**。promptは「正しい対応」を問うが、`selectionPolarity=incorrect`かつcorrect=[B,D]で、両方とも誤った対応。promptどおりの正答がない。**修正案**: promptを「誤った対応を2つ」に変更するか、正しい対応を問うならcorrect=[A,D]等へ設問全体を再設計する。 |
| fund-network-110 | C,E | **OK**。DNS失敗でHTTPを調べる、全開放はいずれも誤り。 |

### networking追加指摘

- **P0 `fund-network-103`**: 正しい/誤りの極性反転に加え、正しい選択肢がB/Cの2つあるため選択数も不整合。
- **P0 `fund-network-109`**: 「正しい対応」と誤りmetadataの不一致。B/Dは誤った対応としては正しいキーだが、現promptでは反転している。

## domain-dns

4目標は名前解決、A/AAAA/CNAME/NS、TTL/cache、DNSと接続/TLS/HTTPの責務境界に対応する。本文は権威DNS・委任・cache期限・後段切り分けの順序を説明している。

| ID | 回答照合 | 判定 |
|---|---|---|
| fund-dns-001 | A | **OK**。DNSは名前をIP等へ対応付ける。 |
| fund-dns-002 | B | **OK**。名前解決失敗では問い合わせ名とNS委任を先に確認する。 |
| fund-dns-101 | C | **OK**。DNSがIPを返しても接続/TLS/HTTPは別段階。 |
| fund-dns-102 | B | **OK**。AAAAはIPv6でありIPv4ではない。 |
| fund-dns-103 | A | **P0**。promptは「適切な判断」を問うが、`selectionPolarity=incorrect`かつcorrect=A。Aは誤ったNS用途なのでキー自体は誤り選択として成立する一方、promptと極性が反転している。またB（CNAME）とC（固定IPv4ならA）がともに適切で、requiredChoices=1では一意でない。**修正案**: promptを「誤っているもの」に変更してAを残すか、「適切なものを2つ」に変更しcorrect=[B,C]・requiredChoices=2・polarity=correct。 |
| fund-dns-104 | A | **OK**。IPv6の直接対応はAAAA。 |
| fund-dns-105 | B,E | **OK**。TTLはcache秒数、短いTTLは再問い合わせを増やす。 |
| fund-dns-106 | A,C | **OK**。変更前にTTLを下げて旧期限を考慮し、変更後に解決結果を確認する。 |
| fund-dns-107 | B,D | **OK**。利用者cacheと権威/リゾルバ結果を分けて確認する。 |
| fund-dns-108 | A,D | **OK**。DNS成功はTLS正しさを保証せず、404はHTTPなのでNSだけで直さない。 |
| fund-dns-109 | B,E | **OK**。DNS成功後の証明書エラーにDNS変更や404待ちを使うのは誤り。 |
| fund-dns-110 | C,E | **OK**。DNS失敗でHTTPを調べること、全DNSレコード削除が誤り。 |

### domain-dns追加指摘

- **P0 `fund-dns-103`**: prompt「適切」とmetadata `incorrect`が不一致。さらにB/Cの2つが適切で単一選択になっていない。

## 共通確認

3単元とも4目標・4section・12問で、各問のobjective/section参照、全選択肢explanation、https source、learning.reason/conceptは存在する。形式分布は各単元で正しい1/誤り1/正しい複数/誤り複数が各3問。ただし件数・parse成功は正答の証拠ではなく、上記3件のprompt/metadata/正答設計を修正後に再解答が必要。

## 修正依頼一覧

1. **P0 `fund-network-103`**: 正しい判断を問うpromptとincorrect metadata/correct=Aが不一致。B/Cの複数正答も解消する。
2. **P0 `fund-network-109`**: 正しい対応を問うpromptとincorrect metadata/correct=[B,D]が不一致。
3. **P0 `fund-dns-103`**: 適切な判断を問うpromptとincorrect metadata/correct=Aが不一致。B/Cの複数正答も解消する。

## source hash

レビュー時点の対象JSON sha256（rootが修正後に更新すること）:

```text
b5928c7f02ce85e18666584b64ae4443c0c7e919e0fa6bb658ece474b704a86e  docs/fundamentals-drafts/core-services.json
0bf1d875af7252371f6aa57fc04fb600e54bd628717d89860aaa24bb64c7c90f  docs/fundamentals-drafts/networking-basics.json
873c7f7881e0b604f3d1bff90f9aefbc424e612f99f63ad0b18a6ad895e6d03c  docs/fundamentals-drafts/domain-dns.json
```
