# 基礎学習・先頭6単元の設問内容レビュー

## 範囲と方法

読み取り対象は `public/fundamentals/content.json` の先頭6単元（最終問題72問）と `public/fundamentals/checkpoints.json` の同6単元（checkpoint24問）、合計96問。各問について本文で判断根拠が説明されているか、promptの正誤極性・必要選択数、正答key、選択肢の事実、全解説が一致するかを実際に解いた。件数・parse成功は内容の正しさの根拠にしていない。

レビュー時点のsource hash:

- `public/fundamentals/content.json`: `332961193717ac32151fd24fbb36f255d78113e72c761e574a2cbd1d5fd6fc25`
- `public/fundamentals/checkpoints.json`: `95d4d43087142affef0d380674b73c5063051553f6c5da70572dc84560a13296`

## 要修正

### P1: fund-cloud-111（比較判断になっていない）

promptは「同じAZに3台ある案と、異なるAZに2台ある案を比べます」としているが、正答A「性能は必要な処理量と資源の能力から評価する」とB「AZ障害への備えは配置と依存先から評価する」は、どちらの案にも適用できる抽象的な一般論である。台数・配置・残存能力・依存先の具体的な前提がなく、二案の比較判断を測れていない。解説も「台数だけでは処理能力は決まりません」に留まり、比較結果を導かない。

修正案: 月間処理量、1台あたりの処理能力、AZ喪失時に残る台数、共有依存先を明示し、「通常時の容量」と「1 AZ喪失時に必要容量を満たすか」を別々に判断させる。例えば「必要処理量が毎分180件、1台が100件、AZ障害後も120件必要」のようにして、3台同一AZ案は容量を満たすがAZ障害で全停止、2台分散AZ案はAZ障害後100件で不足、という異なる判断を選ばせる。

### 再検証で疑義なし: fund-services-108

前版の指摘は誤りだった。JSONは `selectionPolarity=incorrect`、`requiredChoices=2`、`correct=[B,D]` であり、B「IAMをCSV本文の保存先にする」とD「EC2を選んだらDBの検索要件を考えない」という誤った判断を正しく選ばせている。4要件すべてを正答にする問題ではないため、修正不要と判定を改める。

### 再検証で疑義なし: fundamentals.core-services.checkpoint.composition.v1

前版の指摘は誤りだった。正答B/Cは、画像保存と注文検索という2つの役割分解を選ぶ設問の正答であり、3要件すべてを選ぶという意味ではない。必要選択数2、correct key、本文根拠に矛盾はない。


### root原文照合で撤回: fund-network-106

問題文は「正しい確認を2つ」であり、「最初に」「優先順位」を問うていない。本文の同じ事例にもIP/443接続と証明書・ホスト名の両方が記載され、正答A/Cは本文から判断できる。監査側が「最初に確認する」という条件を付け足した指摘を撤回し、設問は変更しない。

修正案: 「TCP接続は成功し、証明書検証で失敗した」と前提を明記してAだけを正答にするか、「接続経路をまだ確認していない」としてCを残す。現状は選択肢の正しさ自体より、観測地点と問う順序の不一致が問題。

## 疑義なし（最終問題）

上記2問を除き、promptの極性・必要選択数・correct key・選択肢の事実・learning.reasonが本文で判断可能だった。定義確認のrecall問題は、到達目標の用語確認として抽象性を許容した。

- `fundamentals.cloud-concepts`: fund-cloud-101, fund-cloud-102, fund-cloud-103, fund-cloud-001, fund-cloud-105, fund-cloud-106, fund-cloud-002, fund-cloud-108, fund-cloud-109, fund-cloud-110, fund-cloud-112
- `fundamentals.core-services`: fund-services-001, fund-services-002, fund-services-101, fund-services-102, fund-services-103, fund-services-104, fund-services-105, fund-services-106, fund-services-107, fund-services-109, fund-services-110
- `fundamentals.identity-access`: fund-iam-101, fund-iam-102, fund-iam-103, fund-iam-104, fund-iam-105, fund-iam-106, fund-iam-107, fund-iam-108, fund-iam-109, fund-iam-110, fund-iam-111, fund-iam-112
- `fundamentals.data-protection`: fund-data-101, fund-data-102, fund-data-103, fund-data-104, fund-data-105, fund-data-106, fund-data-107, fund-data-108, fund-data-109, fund-data-110, fund-data-111, fund-data-112
- `fundamentals.networking-basics`: fund-network-001, fund-network-002, fund-network-101, fund-network-102, fund-network-103, fund-network-104, fund-network-105, fund-network-107, fund-network-108, fund-network-109, fund-network-110
- `fundamentals.domain-dns`: fund-dns-001, fund-dns-002, fund-dns-101, fund-dns-102, fund-dns-103, fund-dns-104, fund-dns-105, fund-dns-106, fund-dns-107, fund-dns-108, fund-dns-109, fund-dns-110

## 疑義なし（checkpoint）

24問すべて、本文の因果を具体的なシナリオへ移し、promptの必要選択数とcorrect keyが一致していた。誤答も本文から否定でき、解説が正答の理由を説明している。

- `fundamentals.cloud-concepts`: `...on-demand.v1`, `...shared-responsibility.v1`, `...regions-az.v1`, `...tradeoffs.v1`
- `fundamentals.core-services`: `...compute.v1`, `...storage.v1`, `...database.v1`
- `fundamentals.identity-access`: `...authn-authz.v1`, `...principal-role.v1`, `...policy-deny.v1`, `...least-privilege.v1`
- `fundamentals.data-protection`: `...encryption.v1`, `...kms.v1`, `...recovery.v1`, `...secrets.v1`
- `fundamentals.networking-basics`: `...ip-port.v1`, `...transport.v1`, `...http-tls.v1`, `...diagnosis.v1`
- `fundamentals.domain-dns`: `...resolution.v1`, `...records.v1`, `...ttl.v1`, `...boundary.v1`

## 対応状況

96問を読み取り完了。前版の極性・正答キーの誤認2件に加え、root原文照合で`fund-network-106`の条件付加を撤回した。採用する修正は`fund-cloud-111`の具体的な障害後の比較であり、その他95問の必須修正は採用しない。以下のID表は監査対象の公開済み原版であり、新版の実装・公開完了を意味しない。

## 全96問のJSON属性（再現可能な抽出表）

本文・選択肢の内容レビューとは分離して、JSONから全IDの極性、必要選択数、correct keyを再抽出した。`fund-services-108` のような `incorrect` 問題は、correct keyが「誤った選択肢」であることを前提に本文と照合した。

| unit | id | polarity | n | correct |
|---|---|---:|---|---|
| cloud | fund-cloud-101 | correct | 1 | A |
| cloud | fund-cloud-102 | incorrect | 1 | B |
| cloud | fund-cloud-103 | correct | 2 | A,B |
| cloud | fund-cloud-001 | correct | 1 | B |
| cloud | fund-cloud-105 | incorrect | 1 | C |
| cloud | fund-cloud-106 | incorrect | 2 | C,D |
| cloud | fund-cloud-002 | incorrect | 1 | B |
| cloud | fund-cloud-108 | correct | 2 | A,B |
| cloud | fund-cloud-109 | incorrect | 2 | C,D |
| cloud | fund-cloud-110 | correct | 1 | A |
| cloud | fund-cloud-111 | correct | 2 | A,B |
| cloud | fund-cloud-112 | incorrect | 2 | B,C |
| services | fund-services-001 | correct | 1 | A |
| services | fund-services-002 | correct | 1 | B |
| services | fund-services-101 | correct | 1 | A |
| services | fund-services-102 | incorrect | 1 | B |
| services | fund-services-103 | incorrect | 1 | A |
| services | fund-services-104 | incorrect | 1 | C |
| services | fund-services-105 | correct | 2 | A,D |
| services | fund-services-106 | correct | 2 | B,E |
| services | fund-services-107 | correct | 2 | A,C |
| services | fund-services-108 | incorrect | 2 | B,D |
| services | fund-services-109 | incorrect | 2 | A,E |
| services | fund-services-110 | incorrect | 2 | C,D |
| iam | fund-iam-101 | correct | 1 | A |
| iam | fund-iam-102 | correct | 1 | B |
| iam | fund-iam-103 | correct | 1 | A |
| iam | fund-iam-104 | incorrect | 1 | B |
| iam | fund-iam-105 | incorrect | 1 | C |
| iam | fund-iam-106 | incorrect | 1 | A |
| iam | fund-iam-107 | correct | 2 | A,D |
| iam | fund-iam-108 | correct | 2 | B,E |
| iam | fund-iam-109 | correct | 2 | A,C |
| iam | fund-iam-110 | incorrect | 2 | B,D |
| iam | fund-iam-111 | incorrect | 2 | A,E |
| iam | fund-iam-112 | incorrect | 2 | C,D |
| data | fund-data-101 | correct | 1 | A |
| data | fund-data-102 | correct | 1 | B |
| data | fund-data-103 | incorrect | 1 | C |
| data | fund-data-104 | incorrect | 1 | B |
| data | fund-data-105 | incorrect | 1 | A |
| data | fund-data-106 | correct | 2 | B,D |
| data | fund-data-107 | correct | 1 | A |
| data | fund-data-108 | correct | 2 | B,C |
| data | fund-data-109 | correct | 2 | A,D |
| data | fund-data-110 | incorrect | 2 | B,D |
| data | fund-data-111 | incorrect | 2 | A,E |
| data | fund-data-112 | incorrect | 2 | C,D |
| networking | fund-network-001 | correct | 1 | A |
| networking | fund-network-002 | correct | 1 | B |
| networking | fund-network-101 | incorrect | 1 | C |
| networking | fund-network-102 | incorrect | 1 | B |
| networking | fund-network-103 | incorrect | 1 | A |
| networking | fund-network-104 | correct | 1 | A |
| networking | fund-network-105 | correct | 2 | B,E |
| networking | fund-network-106 | correct | 2 | A,C |
| networking | fund-network-107 | correct | 2 | B,D |
| networking | fund-network-108 | incorrect | 2 | A,E |
| networking | fund-network-109 | incorrect | 2 | A,C |
| networking | fund-network-110 | incorrect | 2 | C,E |
| dns | fund-dns-001 | correct | 1 | A |
| dns | fund-dns-002 | correct | 1 | B |
| dns | fund-dns-101 | incorrect | 1 | C |
| dns | fund-dns-102 | incorrect | 1 | B |
| dns | fund-dns-103 | incorrect | 1 | A |
| dns | fund-dns-104 | correct | 1 | A |
| dns | fund-dns-105 | correct | 2 | B,E |
| dns | fund-dns-106 | correct | 2 | A,C |
| dns | fund-dns-107 | correct | 2 | B,D |
| dns | fund-dns-108 | incorrect | 2 | A,D |
| dns | fund-dns-109 | incorrect | 2 | B,E |
| dns | fund-dns-110 | incorrect | 2 | C,E |

| unit | checkpoint id | polarity | n | correct |
|---|---|---:|---|---|
| cloud | fundamentals.cloud-concepts.checkpoint.on-demand.v1 | correct | 1 | A |
| cloud | fundamentals.cloud-concepts.checkpoint.shared-responsibility.v1 | correct | 1 | B |
| cloud | fundamentals.cloud-concepts.checkpoint.regions-az.v1 | correct | 1 | C |
| cloud | fundamentals.cloud-concepts.checkpoint.tradeoffs.v1 | correct | 2 | A,B |
| services | fundamentals.core-services.checkpoint.compute.v1 | correct | 1 | D |
| services | fundamentals.core-services.checkpoint.storage.v1 | correct | 1 | A |
| services | fundamentals.core-services.checkpoint.database.v1 | correct | 1 | B |
| services | fundamentals.core-services.checkpoint.composition.v1 | correct | 2 | B,C |
| iam | fundamentals.identity-access.checkpoint.authn-authz.v1 | correct | 1 | C |
| iam | fundamentals.identity-access.checkpoint.principal-role.v1 | correct | 1 | D |
| iam | fundamentals.identity-access.checkpoint.policy-deny.v1 | correct | 2 | C,D |
| iam | fundamentals.identity-access.checkpoint.least-privilege.v1 | correct | 2 | D,A |
| data | fundamentals.data-protection.checkpoint.encryption.v1 | correct | 1 | A |
| data | fundamentals.data-protection.checkpoint.kms.v1 | correct | 2 | A,B |
| data | fundamentals.data-protection.checkpoint.recovery.v1 | correct | 1 | B |
| data | fundamentals.data-protection.checkpoint.secrets.v1 | correct | 2 | B,C |
| networking | fundamentals.networking-basics.checkpoint.ip-port.v1 | correct | 1 | C |
| networking | fundamentals.networking-basics.checkpoint.transport.v1 | correct | 1 | D |
| networking | fundamentals.networking-basics.checkpoint.http-tls.v1 | correct | 1 | A |
| networking | fundamentals.networking-basics.checkpoint.diagnosis.v1 | correct | 1 | B |
| dns | fundamentals.domain-dns.checkpoint.resolution.v1 | correct | 1 | C |
| dns | fundamentals.domain-dns.checkpoint.records.v1 | correct | 1 | D |
| dns | fundamentals.domain-dns.checkpoint.ttl.v1 | correct | 1 | A |
| dns | fundamentals.domain-dns.checkpoint.boundary.v1 | correct | 1 | B |
