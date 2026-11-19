# 基礎学習カリキュラム

## 分類表

|順|大分類|中分類|単元ID|前提|到達目標|既存カード|公開|
|---:|---|---|---|---|---|---|---|
|1|`cloud` Cloud|`cloud.concepts` クラウド概念|`fundamentals.cloud-concepts`|なし|責任共有、Region/AZ、可用性の関係を説明する|AWSサービス|published|
|2|`cloud` Cloud|`cloud.services` 主要サービス|`fundamentals.core-services`|1|EC2/S3/IAMの役割を要件から選ぶ|AWSサービス|published|
|3|`security` Security|`security.identity` 認証・認可|`fundamentals.identity-access`|1|認証、認可、最小権限を区別する|不足|planned|
|4|`security` Security|`security.data` データ保護|`fundamentals.data-protection`|3|暗号化、鍵、監査の責務を説明する|不足|planned|
|5|`network` Network|`network.communication` 通信・アドレス|`fundamentals.networking-basics`|1|IP、TCP/UDP、port、経路を説明する|ネットワーク|published|
|6|`network` Network|`network.naming` 名前解決|`fundamentals.domain-dns`|5|ドメイン、zone、record、TTLを説明する|ドメイン名/DNS|published|
|7|`network` Network|`network.connectivity` 接続|`fundamentals.cidr-subnets`|5|prefix、範囲、VPC分割を判断する|CIDR/サブネット|published|
|8|`network` Network|`network.connectivity` 接続|`fundamentals.routing-connectivity`|5,7|route table、IGW、NAT、接続先を説明する|不足|planned|
|9|`delivery` Delivery|`delivery.lifecycle` 開発ライフサイクル|`fundamentals.cicd`|1,5|Source→Build/Test→Deployの目的を説明する|CI/CD|published|
|10|`delivery` Delivery|`delivery.lifecycle` 開発ライフサイクル|`fundamentals.testing-quality`|9|失敗を本番へ流さない検査点を設計する|不足|planned|
|11|`delivery` Delivery|`delivery.lifecycle` 開発ライフサイクル|`fundamentals.release-rollback`|9,10|段階展開、承認、rollbackを選ぶ|不足|planned|
|12|`delivery` Delivery|`delivery.lifecycle` 開発ライフサイクル|`fundamentals.observability`|11|状態・失敗を計測し次の改善へつなぐ|不足|planned|

## 公開単元の学習契約

今回の6単元は、各2問、合計12問以上を教材データとして公開する。各単元は「目標 → 説明 → 具体例 → 確認問題 → 採点 → 選択肢別解説 → 復習/次単元」で構成する。

問題データには `unitId`、`id`、`revision`、`selectionPolarity`（`correct`/`incorrect`）、`requiredChoices` を持たせる。`correct` は設問で選ぶべき選択肢IDの集合であり、選択肢の事実上の真偽集合とは分離する。

12問で、正しいものを1つ、誤っているものを1つ、正しいものを複数、誤っているものを複数の4形式を最低各3問使用する。選択数不足・過剰、集合の完全一致、否定設問の反転を固定テストする。

未学習は単元未開始、学習中は1問以上回答済みで未完了、完了は全確認問題の最新回答が正解、復習対象は最新回答が不正解の問題が残る状態とする。古い不正解履歴が残っていても最新回答が正解なら復習対象から外し、最新回答が不正解なら再び対象にする。履歴キーには将来の資格カタログから解決できる `fundamentals` コースIDを使い、専用採点は作らず既存の `QuestionCard`、`isAnswerComplete`、`isCorrectAnswer`、`saveAttempt`、`LearningNotes` を再利用する。

## 内容根拠

- Cloud: [AWS Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/)、[Regions and Availability Zones](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html)
- Services: [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)、[IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html)、[EC2 User Guide](https://docs.aws.amazon.com/pdfs/AWSEC2/latest/UserGuide/ec2-ug.pdf)
- Network: [RFC 4632 CIDR](https://www.rfc-editor.org/rfc/rfc4632)、[RFC 9293 TCP](https://www.rfc-editor.org/rfc/rfc9293)、[RFC 768 UDP](https://www.rfc-editor.org/rfc/rfc768)、[VPC subnet route tables](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html)
- DNS: [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034)、[RFC 1035](https://www.rfc-editor.org/rfc/rfc1035)、[Route 53 record values and TTL](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-shared.html)
- Delivery: [CodePipeline stages and actions](https://docs.aws.amazon.com/codepipeline/latest/userguide/pipelines.html)
