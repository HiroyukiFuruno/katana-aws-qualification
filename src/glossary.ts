const terms: readonly (readonly [term: string, expansion: string, definition: string])[] = [
  [
    'ABAC',
    'Attribute-based access control',
    'ユーザーやリソースに付けたタグなどの属性を照合してアクセスを制御する方式。チームごとに同じポリシーを複製する代わりに、チームタグの一致を条件にできる。',
  ],
  [
    'ACID',
    'Atomicity, consistency, isolation, durability',
    'トランザクションに求める原子性・一貫性・分離性・耐久性。複数の更新をまとめ、途中失敗で一部だけ反映されることを防ぎたいときの判断軸になる。',
  ],
  [
    'ACM',
    'AWS Certificate Manager',
    'TLS証明書の発行や管理を行うAWSサービス。対応するAWSサービスに紐付けたAWS発行の証明書は、検証要件を満たせば管理更新を利用できる。',
  ],
  [
    'ALB',
    'Application Load Balancer',
    'HTTP・HTTPSリクエストを扱うロードバランサー。ホスト名やパスで転送先を変える場合に適し、TCP・UDPの転送を主とするNLBと使い分ける。',
  ],
  [
    'AMI',
    'Amazon Machine Image',
    'EC2インスタンスの起動に用いるイメージ。OSや導入済みソフトウェアをそろえたインスタンスを再作成できる。',
  ],
  [
    'ARN',
    'Amazon Resource Name',
    'AWSリソースを識別する名前。IAMポリシーの対象指定などに使い、サービスによってリージョンやアカウントの部分が空になる場合がある。',
  ],
  [
    'ASG',
    'Auto Scaling group',
    'EC2インスタンスをまとめて台数や健全性を管理するグループ。希望する台数と最小・最大台数を設定できる。',
  ],
  [
    'AZ',
    'Availability Zone',
    'AWSリージョン内の分離された拠点。単一AZの障害に備えるには処理とデータの両方でAZをまたぐ構成を考える。',
  ],
  [
    'Batch inference',
    '',
    '複数の入力をまとめて非同期に推論する方式。結果を即時に返す必要がない大量処理では、常時稼働するリアルタイム推論との比較対象になる。',
  ],
  [
    'Blue/green deployment',
    '',
    '旧環境と新環境を並行稼働させ、検証後に新環境へトラフィックを切り替える方式。旧環境と互換性のあるデータ変更なら切り戻しやすい。',
  ],
  [
    'BGP',
    'Border Gateway Protocol',
    'ネットワーク同士が到達可能な経路を交換するプロトコル。Direct Connectや動的ルーティング対応のSite-to-Site VPNで使う。',
  ],
  [
    'Canary deployment',
    '',
    '新バージョンへ一部のトラフィックを先に送り、エラー率などを確認してから対象を拡大する展開。異常時に影響を小さくできる。',
  ],
  [
    'CDC',
    'Change data capture',
    '追加・更新・削除などの変更を取り込み、別システムに継続反映する方式。データベース移行で通常は初回ロードと組み合わせ、切替時に反映遅れを確認する。',
  ],
  [
    'CIDR',
    'Classless Inter-Domain Routing',
    '10.0.0.0/16のようにネットワークの範囲をプレフィックスで表す方式。VPCを接続する設計では範囲の重複が経路選択に影響する。',
  ],
  [
    'CMK',
    'Customer master key',
    'AWS KMSで以前使われていた用語。現在の総称はKMS keyで、そのうち利用者が作成しポリシーを管理する鍵はcustomer managed keyと呼ぶ。',
  ],
  [
    'CORS',
    'Cross-origin resource sharing',
    '異なるオリジンのリソースをブラウザーから使える条件を、サーバーがHTTPヘッダーで示す仕組み。リソース自体の認証認可も別に適用される。',
  ],
  [
    'CUR',
    'AWS Cost and Usage Reports',
    'AWSの料金と使用量を明細レベルで確認できるレポート。アカウントやサービス別に分析する場合は、集計設定やタグの有効化も確認する。',
  ],
  [
    'DLQ',
    'Dead-letter queue',
    '処理や配信に失敗したメッセージを隔離するキュー。どの処理段階の失敗を回収するかと、再処理前に原因を解消できるかを設計する。',
  ],
  [
    'DR',
    'Disaster recovery',
    '災害時にサービスやデータを復旧するための設計と手順。RPOとRTOを決め、実際の切り替えと切り戻しを検証する。',
  ],
  [
    'DynamoDB Streams',
    '',
    'DynamoDBテーブルの項目変更を時系列に記録する機能。変更に応じて別処理を起動でき、同じ処理の再実行に備えた冪等性が必要になる。',
  ],
  [
    'EBS',
    'Amazon Elastic Block Store',
    'EC2などが使うブロックストレージ。ボリュームはAZに属し、スナップショットを使って別AZに新しいボリュームを作成できる。',
  ],
  [
    'ECS',
    'Amazon Elastic Container Service',
    'コンテナの実行やサービスの維持を管理するAWSのオーケストレーションサービス。EC2やAWS Fargateなどを実行基盤にできる。',
  ],
  [
    'EKS',
    'Amazon Elastic Kubernetes Service',
    'KubernetesをAWSで動かすマネージドサービス。KubernetesのAPIや運用資産を維持する要件があるときの選択肢になる。',
  ],
  [
    'ENI',
    'Elastic network interface',
    'VPC内の仮想ネットワークインターフェイス。サブネットに属し、別のEC2への付け替えはセカンダリENIで同じAZなどの条件を満たす必要がある。',
  ],
  [
    'ETL',
    'Extract, transform, load',
    '元データを抽出し、変換してから保存先へロードする処理。変換をロード後に行うELTとは処理の順序が異なる。',
  ],
  [
    'Fan-out',
    '',
    '一つのイベントを複数の購読先にそれぞれ届ける構成。各消費者の処理速度や再試行を独立させるなら、購読先ごとのキューを検討する。',
  ],
  [
    'Guardrail',
    '',
    '設計や運用を許容範囲内に保つ統制。AWS Control Towerでは現在はcontrolと呼び、操作の予防、違反の検知、作成前の検査などの方式がある。',
  ],
  [
    'IAM',
    'AWS Identity and Access Management',
    'AWSリソースに対するアクセスを制御する仕組み。操作の可否は、主体側・リソース側のポリシーと適用済みの権限上限を合わせて判断する。',
  ],
  [
    'Idempotency',
    '',
    '同じ意味の要求を繰り返しても、処理の結果や副作用が一度だけ実行した場合と同じになる性質。注文や支払いの再試行を安全に扱う鍵になる。',
  ],
  [
    'IGW',
    'Internet gateway',
    'VPCとインターネットとの通信に使うゲートウェイ。EC2からIPv4で直接通信するにはパブリックIPv4、経路、通信を許可する設定が必要になる。',
  ],
  [
    'IRSA',
    'IAM roles for service accounts',
    'EKSでKubernetesのサービスアカウントとIAMロールを結び付ける仕組み。OIDCの信頼条件を絞り、対象のワークロードに必要な権限を割り当てる。',
  ],
  [
    'KMS',
    'AWS Key Management Service',
    '暗号鍵を作成・管理し、暗号操作を制御するAWSサービス。クロスアカウント利用時は鍵ポリシー、呼び出し側の権限、対象サービスの制約を確認する。',
  ],
  [
    'Least privilege',
    '',
    '主体が作業に必要な範囲だけの権限を持つ原則。許可する操作、リソース、利用条件を絞る。',
  ],
  [
    'NACL',
    'Network access control list',
    'サブネット境界の通信を制御するルール。ステートレスなので、必要な通信は往路と復路の両方を許可する。',
  ],
  [
    'NAT',
    'Network address translation',
    'パケットのIPアドレスなどを変換する仕組み。パブリックNAT Gatewayは、プライベートサブネットからインターネットへ開始するIPv4通信などに使う。',
  ],
  [
    'NLB',
    'Network Load Balancer',
    'TCP・UDP・TLSなどを扱うロードバランサー。AZ単位の固定IPが必要な場合などに適し、HTTPのパスベース転送はALBの機能。',
  ],
  [
    'OAC',
    'Origin access control',
    'CloudFrontがS3などの対応オリジンへのリクエストを認証する仕組み。利用者がオリジンへ直接アクセスする経路を閉じ、CloudFront経由の配信に限定できる。',
  ],
  [
    'OIDC',
    'OpenID Connect',
    'OAuth 2.0の上に構築された認証仕様。AWSとの連携では、OIDCプロバイダーが発行したトークンの条件を検証して一時的なAWS認証情報を取得できる。',
  ],
  [
    'OU',
    'Organizational unit',
    'AWS Organizationsでアカウントを階層的にまとめる単位。OUに付けたSCPは配下のメンバーアカウントにも効く。OUへの所属だけでIAM権限は付与されない。',
  ],
  [
    'PITR',
    'Point-in-time recovery',
    '保持期間内の指定時点へデータを復元する機能。サービスごとの保持期間、直近の復元可能時刻、新リソース作成の有無を確認する。',
  ],
  [
    'Pilot light',
    '',
    '災害対策先でデータや主要な部品だけを維持し、災害時にサービス全体を立ち上げる方式。すぐ動く縮小環境を維持するウォームスタンバイより復旧手順が増えやすい。',
  ],
  [
    'PrivateLink',
    'AWS PrivateLink',
    'インターネットを経由せずサービスへプライベート接続する仕組み。VPC同士を広く接続する必要がなく、接続するVPCのCIDRが重複する場合にも使える構成がある。',
  ],
  [
    'RAG',
    'Retrieval-augmented generation',
    '関連文書を検索し、取得内容をモデルへの入力に加えて回答を生成する方式。検索漏れと、取得内容を反映できない生成側の問題を分けて評価する。',
  ],
  [
    'RCP',
    'Resource control policy',
    'AWS Organizationsで対応するリソースに対して付与できる権限の上限を定めるポリシー。主体側の上限を定めるSCPと使い分ける。',
  ],
  [
    'RPO',
    'Recovery point objective',
    '復旧時に許容できるデータ損失を時間で表した目標。たとえばRPOが5分なら、障害時点からさかのぼって失ってよいデータは最大5分ぶん。',
  ],
  [
    'RTO',
    'Recovery time objective',
    '障害からサービスを復旧するまでに許容できる目標時間。復元だけでなく、再起動、名前解決の切り替え、正常性の確認も見込む。',
  ],
  [
    'SCP',
    'Service control policy',
    'AWS OrganizationsでメンバーアカウントのIAM主体が取得できる権限の上限を定めるポリシー。アクセスを許可するにはIAMなどのポリシーも必要。',
  ],
  [
    'Security group',
    '',
    'VPC内のリソースの通信を許可ルールで制御する仕組み。ステートフルで、許可した通信への応答は別の許可ルールなしで戻せる。',
  ],
  [
    'SLO',
    'Service level objective',
    '利用者に提供するサービス品質の目標値。たとえば1か月の正常応答率99.9%を設定し、実測する指標と計測範囲を定める。',
  ],
  [
    'SSE-KMS',
    'Server-side encryption with AWS KMS keys',
    'S3などの保存データをサービス側で暗号化し、その鍵管理にAWS KMSを使う方式。オブジェクト操作権限に加え、対応するKMS権限も必要になる。',
  ],
  [
    'STS',
    'AWS Security Token Service',
    'AWSへのアクセスに使う一時的な認証情報を発行するサービス。ロールを引き受ける場合は、ロールの信頼条件と呼び出し側の権限を確認する。',
  ],
  [
    'TGW',
    'AWS Transit Gateway',
    '複数のVPCやオンプレミスネットワークをハブでつなぐサービス。アタッチメントごとの経路表の関連付けや伝播を設計する。',
  ],
  [
    'TTL',
    'Time to live',
    'データやキャッシュを有効とみなす期間。DNSではキャッシュ期間、DynamoDBのTTLでは期限を過ぎた項目の自動削除に使う。',
  ],
  [
    'VPC',
    'Virtual private cloud',
    'AWS上で論理的に分離したネットワーク。IP範囲、サブネット、経路、接続先を定め、公開と非公開の通信経路を設計する。',
  ],
  [
    'VPC endpoint',
    '',
    'インターネットを経由せずにサービスへ到達するためのVPC接続点。インターフェイス型ではENIとDNS、ゲートウェイ型では対応サービスへの経路表を使う。',
  ],
  [
    'WAF',
    'Web application firewall',
    'HTTPリクエストを条件に応じて許可・ブロック・カウントする仕組み。AWS WAFはCloudFrontやALBなど対応するサービスに関連付けて使う。',
  ],
  [
    'Warm standby',
    '',
    '災害対策先に機能する縮小版のシステムを常時稼働させ、障害時に拡張する方式。コストと切替時間の両方を見てパイロットライトと比較する。',
  ],
];

const alphabetic = new Intl.Collator('en', { sensitivity: 'base' });
export const glossary = [...terms].sort(([left], [right]) => alphabetic.compare(left, right));
