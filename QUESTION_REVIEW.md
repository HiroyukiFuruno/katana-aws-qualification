# SAA-C03 設問レビュー

2026-11-18。模試65問を改訂し、公式サンプルをもとにした学習用10問も点検した。模試は公式試験ガイドの4分野と、想定知識が不足していれば選び得る選択肢という方針に沿って点検した。制約に対して正解が成立するか、誤答がどの条件を満たさないか、技術解説が過剰な保証をしていないかを確認した。

出題配分はセキュリティ19、レジリエンス17、パフォーマンス16、コスト最適化13。改訂した模試に版番号2を付け、正解ラベルは組み替えた。旧版の結果・受験途中の解答には旧版の問題データを用いる。実試験の受験データを用いた難易度等化は行っていない。

[AWS SAA-C03 試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03.html)

## 模試の設問別レビュー

| 設問ID | テーマ | 指摘と修正 |
|---|---|---|
| `mock-secure-01` | 組織全体のS3アクセス制限 | 公開という表現を修正し、ロール名の照合だけでは組織外を排除できない選択肢を追加。 |
| `mock-secure-02` | CloudFrontからのプライベート配信 | 複数URLに共通の認可を要求し、署名付きURLが同等解になる余地を除いた。 |
| `mock-secure-03` | KMS外部アカウントへの読み取り | 権限境界に絞り、データキー生成やAWS管理キーを選ぶ誤答がなぜ成立しないかを明確化。 |
| `mock-secure-04` | ECSの権限境界 | タスクロールと実行ロールを比較する問題に絞り、タスク単位で権限が共有される前提を明示。 |
| `mock-secure-05` | CloudFrontのキャッシュと個人情報 | トークンをキャッシュキーに含める構成も要件を満たし得たため、注文APIの即時性を追加。 |
| `mock-secure-06` | EKSのポッド別権限 | IRSAの信頼ポリシーで主体を絞る点を問う。Pod Identityが別解にならないようノード条件を限定。 |
| `mock-secure-07` | プライベートサブネットからのS3アクセス | エンドポイントポリシーのスコープとバケットポリシーの違いを明示。 |
| `mock-secure-08` | 踏み台なしの運用アクセス | VPN案に比べ有力なSSHトンネルとの差を、ログ取得要件で判断できる形にした。 |
| `mock-secure-09` | データの持ち出し防止 | アカウントレベルの具体的な解除操作を対象にし、検知・非同期修復・予防を比較。 |
| `mock-secure-10` | Private API Gateway | プライベート接続、リソースポリシー、VPCエンドポイントポリシーの位置を比較。 |
| `mock-secure-11` | 変更不能な監査ログ | Object Lockで保護されるのは保持対象バージョンであり、新バージョン作成も禁止するという誤読を修正。 |
| `mock-secure-12` | Lambdaの秘密情報ローテーション | KMSのローテーションとDB認証情報の変更を区別。接続経路とアプリ反映条件を追加。 |
| `mock-secure-13` | CloudTrailの権限分離 | 組織証跡と委任されたログ集約手段の適用範囲を比較。 |
| `mock-secure-14` | ALBでHTTPアプリを防御 | WAFを置くだけの問題から、集計条件と例外のスコープを判断する問題へ変更。 |
| `mock-secure-15` | クロスアカウントS3アップロード | 受け付けるACLヘッダーの前提と、受領側がオブジェクトを所有する条件を明示。 |
| `mock-secure-16` | 組織外へのキー利用制約 | KMSの経路・鍵・対象S3の違いが判別できる具体例にした。 |
| `mock-secure-17` | ユーザー認証とSTS | 直接STSを用いる実装との差が明確になるよう、既存OIDCを維持しつつ資格情報ブローカーを管理しない条件を追加。 |
| `mock-secure-18` | オンプレミスからのS3到達 | VPN越しのゲートウェイ型とインターフェイス型を比較し、名前解決条件を具体化。 |
| `mock-secure-19` | VPC間でサービスだけを提供 | 重複CIDRとサービス単位の公開を独立した制約として扱う。 |
| `mock-resilience-01` | S3イベントの重複と順序 | 比較だけで競合を防げるとは限らないため、比較と更新を同一の原子的操作に限定。 |
| `mock-resilience-02` | 決済処理の多重実行 | SQSの配送上の重複排除と決済APIの副作用の一意性を区別。 |
| `mock-resilience-03` | 可用性と災害対策 | 曖昧なRPOと平時検証を明確化し、パイロットライトとの比較を追加。 |
| `mock-resilience-04` | 同一グループ内の順序と並列処理 | 処理順の起点とワーカーの実行モデルを明示。 |
| `mock-resilience-05` | SQSバッチの部分失敗 | 部分失敗の再試行と、標準キュー全体での重複排除保証を混同しない形にした。 |
| `mock-resilience-06` | AZ障害時のインターネット出口 | リージョナルNATを選べる環境と区別し、許可済みEIPを維持する条件を追加。 |
| `mock-resilience-07` | ECSの安全な展開 | ECSサーキットブレーカーとCloudWatchアラームも別解になる一般的表現を修正。 |
| `mock-resilience-08` | DNSで障害先を除外 | 既存の単一DNS名と通常系への固定を前提にし、低重み案との差を明示。 |
| `mock-resilience-09` | Redisのフェイルオーバー | サービス名からの連想ではなく昇格の要件を比較。レプリケーションは非同期と明記。 |
| `mock-resilience-10` | オンプレミスの接続冗長化 | 物理回線への依存関係と、予備経路の切り替え（BGP）の論点を明示。 |
| `mock-resilience-11` | リージョン障害に備えたデータ書き込み | 結果整合モードと単一ライターを比較できる形に整理。 |
| `mock-resilience-12` | 複数ステップの業務再試行 | StandardとExpressを比較するため長時間処理・履歴要件を追加。 |
| `mock-resilience-13` | Kinesisのデータ再生 | Kafkaが別解になり得るため、既存Kinesisの経路を維持する前提を置いた。 |
| `mock-resilience-14` | S3保護と復旧 | バージョン指定の永久削除と削除マーカーを区別。ライブ複製と既存データのバックフィルを問う。 |
| `mock-resilience-15` | RDSの復元ポイント | 時点復元の前提となる保持期間と、最新復元可能時刻を明示。 |
| `mock-resilience-16` | EventBridgeの配信失敗 | 権限エラーが再試行されない場合もあるため、対象を配信失敗一般に修正し、受信後の実行失敗と区別。 |
| `mock-resilience-17` | リージョン切替時の静的配信 | CloudFrontのフェイルオーバー対象メソッドと、クライアント向けDNSが変わらない要件を具体化。 |
| `mock-performance-01` | RDSの接続ストーム | レプリカ追加や同時実行制限と比較。接続再利用が有効となる短いトランザクションを明記。 |
| `mock-performance-02` | DynamoDBの偏り | 単一ホットアイテムとホットキーを区別。書き込み分散・読取ファンアウトのトレードオフを明示。 |
| `mock-performance-03` | EBSの持続IOPS | gp3も高IOPSを提供し得るため、性能だけでなく耐久性で除外できるようにした。 |
| `mock-performance-04` | Linuxの共有ファイル | EFS One ZoneとFSx案を要件で比較できるようにした。 |
| `mock-performance-05` | 世界各地からのS3アップロード | 転送経路と再送粒度をそれぞれ検証。CloudFrontのPUTも使えるので理由を取り違えない。 |
| `mock-performance-06` | Auroraの読み取りスケール | リーダーエンドポイントは接続単位で分散する点を追記。負荷に合わせた増減との組み合わせを比較。 |
| `mock-performance-07` | 高頻度更新APIのキャッシュ | キャッシュ障害時のフォールバックと鮮度を両方問う。 |
| `mock-performance-08` | Kinesisの独立読み取り | 保持期間よりも共有スループットがボトルネックだとデータで示した。 |
| `mock-performance-09` | Lambdaの起動遅延 | Reserved Concurrency、SnapStart、Provisioned Concurrencyの違いを問う。 |
| `mock-performance-10` | トラフィックに先行する容量増強 | 予測スケーリングも別解になり得るため、実績データのない既知の初回イベントを採用。 |
| `mock-performance-11` | 分析クエリの読み取り量 | 時間と列という二つの読み飛ばしを分け、圧縮だけの有効範囲を説明。 |
| `mock-performance-12` | グローバルTCP入口 | Global Acceleratorを固定共通入口とヘルスベース切替の両方で評価。 |
| `mock-performance-13` | SMBの互換性 | 同じSMBとADを提供しても、単一AZでは要件を満たさない比較肢を用意。 |
| `mock-performance-14` | HPCの一時作業領域 | EFSや自前転送との差が明確になるよう、S3のネイティブ連携を要求。 |
| `mock-performance-15` | DynamoDBの検索モデル | LSIはテーブルに後付けできない点と、パーティションキーを変えられない点を明確化。 |
| `mock-performance-16` | CloudFrontのキャッシュ効率 | 転送する値とキャッシュキーに含める値を区別し、アクセス解析要件も追加。 |
| `mock-cost-01` | S3の予測できないアクセス | 未知のアクセス頻度だけでなく、取り出し料金と即時性の両方を判断。 |
| `mock-cost-02` | EC2とFargateの利用料 | インスタンス変更だけでなくEC2からFargateへの移行をまたぐコミットメントを問う。 |
| `mock-cost-03` | スポットで安全にバッチを回す | 価格優先だけでは供給集中を招くため、容量候補と配分戦略を個別判定。 |
| `mock-cost-04` | 不要なNAT転送 | 接続サービスの選択を、時間・処理料金と既存の外向き経路を保つ条件で比較。 |
| `mock-cost-05` | EBSの容量と性能の分離 | サイズを縮める操作と性能を独立指定する操作を切り分けた。 |
| `mock-cost-06` | 長期ログ保管の費用 | 取り出し期限・頻度・保管期間を比較し、中間的なアーカイブ階層を誤答に採用。 |
| `mock-cost-07` | DynamoDBの不規則な負荷 | 自動スケーリング付きプロビジョンドも比較対象に含め、負荷履歴の前提を追加。 |
| `mock-cost-08` | ログのクエリと保持 | 14日の検索要件と1年保管を満たすため、新規転送と既存バックフィルの順序を明示。 |
| `mock-cost-09` | S3の未完了アップロード | 正常アップロードと未完了パートを区別できる運用条件を追加。 |
| `mock-cost-10` | 分析環境のアイドル費 | 同じサーバーレスSQLでも、既存データと部門別のスキャン制御を判断軸に。 |
| `mock-cost-11` | イメージの世代管理 | 90日はプッシュ時点から、CIの対象はタグ付きイメージのみとし、アーカイブと削除を区別。 |
| `mock-cost-12` | 定期実行する長時間コンテナ | AWS Batchも別解になり得るため、既存のECSタスク定義を再利用する条件を明示。 |
| `mock-cost-13` | NAT料金を抑えたサービス接続 | S3 NAT設問との重複を解消し、ゲートウェイエンドポイントの到達境界とコストを同時に問う。 |

## 学習用の公式サンプル再構成問題

| 問 | 確認・修正 |
|---|---|
| 1 | パブリックIPを付けない条件を確認し、NATのElastic IPとインターネットゲートウェイへの経路を解説に追加。 |
| 2 | 通常停止やEBSのスナップショットではRAMを保持しない点を確認。 |
| 3 | セカンダリENIの移動条件となる同一AZと、既存IPv4の維持を確認。 |
| 4 | 認証済みリクエストを前提とし、必要なCORSヘッダーを補足。 |
| 5 | SSE-C受付の前提を確認し、アップロード後の暗号化と顧客鍵による当初からの暗号化を区別。 |
| 6 | 暫定増強、長期契約回避、中断不可をそれぞれ確認。 |
| 7 | ライターとスタンバイの違い、ワーカーによる負荷調整と冪等性を確認。 |
| 8 | WebとDBの両方に、単一AZを失っても復旧できる構成が必要なことを確認。 |
| 9 | NLBとALBのスロースタート対応差、およびメトリクス集計との違いを追記。 |
| 10 | Auroraのリーダーエンドポイントによる分散が接続単位であることを追記。 |

[AWS公式サンプル問題](https://d1.awsstatic.com/ja_JP/training-and-certification/docs-sa-assoc/AWS-Certified-Solutions-Architect-Associate_Sample-Questions.pdf)

## 他資格の初回レビュー

2026-11-19に、SAA-C03以外の12コースに追加したオリジナル演習72問を確認した。各問で要件を満たす選択肢が一つに絞れるか、各誤答の解説が設問の前提と一致するか、正答後に確認できる補足があるかを点検した。例えばCodeDeployの問題では初回に移すトラフィック比率を指定し、KMSの問題では管理主体と鍵の種類を明示した。各資格の初回分は全6問で、本試験の出題範囲全体をカバーする模試はSAA-C03に収録している。

[AWS認定 試験ガイド一覧](https://docs.aws.amazon.com/aws-certification/latest/examguides/)

## 2026-11-19 全資格の拡充レビュー

12資格の既存72問を、業務シナリオ、制約、選択肢別の根拠を持つ設問として改訂した。全13資格に2問ずつ計26問を追加し、うち3問は2択回答形式とした。設問と正解の対応、複数選択の指定、誤答が満たさない条件を確認した。例えばKinesisの部分失敗はSQSのメッセージIDと区別し、RAGの検索漏れと生成段階の根拠不足を異なる指標で測る。Transit Gatewayの最長一致と同一プレフィックスでの優先順位も問題文で分離した。

Solutions Architect ProfessionalはSAP-C03のガイドへ更新し、旧版の模試履歴・途中データを読み込めるよう旧データを保持した。SAA-C03には短縮版の第2回を追加した。他の資格は各8問の短縮演習で、公式の出題配分や本試験の全範囲を網羅する回ではない。難易度は設問レビューで確認し、受験統計による校正は行っていない。

- [AWS認定の試験ガイド一覧](https://docs.aws.amazon.com/aws-certification/latest/examguides/)
- [SAP-C02とSAP-C03の比較](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-03/sap-03-comparison.html)
- [LambdaのKinesis部分バッチ失敗](https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html)

## 2026-11-19 全資格の追加問題とSAP-C03短縮模試

SAP-C03に18問、ほかの12資格に各2問、合計42問を追加した。既存の設問キーと正解は維持した。新規問題は正答が成立する条件、各誤答が満たさない要件、採点形式と選択数、既存設問との判断の重複を確認した。SAP-C03のレビューでは、イベント処理の低遅延要件を明記し、Cost Categoriesの分割配賦結果が請求額に反映されると読めないよう、結果の参照先を限定した。

SAP-C03は26問の問題プールから、5分野を5・5・3・3・4問に配分する20問・48分の短縮模試を提供する。20問未満では各分野に比例した整数枠を求め、端数の大きい分野から残枠を配る。類似問題の出題制限には、設問の分野と独立した `similarityGroup` を使う。同じ判断を問う問題を追加するときは、既存と同じ識別子を付ける。

- [AWS公式 SAP-C02／SAP-C03の出題配分比較](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-03/sap-03-comparison.html)
- [AWS Cost Categoriesの分割配賦](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/splitcharge-cost-categories.html)
- [S3アーカイブの取得時間](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects-retrieval-options.html)

## SAP-C03 本試験形式への拡張

本試験は75問・180分。AWS公式ガイドの採点対象は65問で、10問は採点対象外。KAQの模試では解説・誤答復習のため全75問を採点する。出題配分はクラウドアーキテクチャ19問、セキュリティ・コンプライアンス・ガバナンス19問、コスト最適化11問、レジリエンス・移行・事業継続11問、運用上の優秀性・自動化15問。

既存26問のIDと改訂を維持して、新規70問を追加した。選択肢別の根拠とAWS公式資料を収録し、似た判断の候補に同じ `similarityGroup` を付けた。96問のうち独立した出題候補は90件。内訳は20・23・15・16・16件。公開時の必要数は分野順に95・95・55・55・75件で、Vercelの公開ビルドで各分野を検査する。

レビューでは既存の重複CIDRとPrivateLinkの判断を重ねる案、同一のバックアップ不変化を別分野で問う案、既存の長時間承認と同じ判断を問う案を採用候補から除いた。S3の既存オブジェクトはBatch Replication、DRの切替はAmazon ARCのゾーン退避とリージョン制御で前提を区別した。

- [AWS公式 SAP-C03試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-03.html)
- [AWS公式 SAP-C03実施情報](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/)

### 追加レビューで採用した10問

106問のうち独立した候補は100件。分野順に23・27・15・19・16件で、公開に必要な残りは72・68・40・36・59件。既存96問のデータは維持した。

- 共有VPCに同一組織の前提を加え、IPAMのホームリージョンとプールのロケールを分けた。EventBridgeは発行側でエンドポイントIDを設定する前提を明記した。
- DynamoDBは、MRECのローカルな条件評価とMRSCの同期複製を区別する。Direct Connectの最大レジリエンスは装置とロケーションの冗長化を問う。ARCの復旧計画には新規利用可能なRegion switchの計画評価を用いる。
- IAMの複数選択では別々の操作の結果を問う。KMSグラントは失効の伝播時間と終了時の取り消しを明記した。Bedrockは呼び出しエンドポイント、対象の入力・出力、S3配信先の制約を問う。タグポリシーは強制に対応するリソースタイプと値を対象にした。

- [DynamoDB グローバルテーブルの仕組み](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html)
- [Direct Connect Resiliency Toolkit](https://docs.aws.amazon.com/directconnect/latest/UserGuide/resiliency_toolkit.html)
- [ARC Region switchの計画評価](https://docs.aws.amazon.com/r53recovery/latest/dg/working-with-rs-plan-evaluation.html)
- [AWS KMS グラント](https://docs.aws.amazon.com/kms/latest/developerguide/grants.html)

### 移行・復旧と運用の追加5問

S3へのファイル転送の再開、EBSの代替AZでの復元、Step Functionsの元の定義での再開、Service Catalogの製品別起動権限、夏時間を反映するEC2運用を追加した。誤答は同じサービスや同じ運用を使う別設計を中心とし、満たせない制約を説明した。

111問のうち独立した候補は105件。分野順に23・27・15・22・18件で、公開に必要な残りは72・68・40・33・57件。75問・180分の試行を128回実行し、各回の分野別配分と類似グループの一意性、母集団の全111 IDが抽選対象になることを確認した。

- [S3マルチパートアップロード](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [EBS Fast Snapshot Restore](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-fast-snapshot-restore.html)
- [Step FunctionsのRedrive](https://docs.aws.amazon.com/step-functions/latest/dg/redrive-executions.html)
- [Service Catalogの起動制約](https://docs.aws.amazon.com/servicecatalog/latest/adminguide/constraints-launch.html)
- [EventBridge Schedulerのスケジュール種別と夏時間](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

### コスト・クラウド設計・セキュリティ・運用の追加28問

コスト14問、クラウド設計7問、セキュリティ4問、運用3問を追加した。単一選択21問、複数選択7問。追加した28件は設問ごとに一次資料の該当節、正答の成立条件、誤答が満たさない制約を確認した。前版111問の内容・識別子・改訂番号を維持した。

- RDSの一括投入では自動容量拡張の連続実行を前提にしない。料金計算ではAuroraの読み書きI/O、LambdaのGB秒、MSK Serverlessのクラスター時間とパーティション時間を分けた。ECRの複合タグ、EKSの配分明細、S3の小容量オブジェクトも請求条件まで確認した。
- Aurora Limitlessの外部キーはコロケーションとシャードキーを確認する。CloudFrontでは下流キャッシュを考慮して素材を別URLで配布する。Glueの再計算は既存のブックマークと出力データに影響させない。EventBridge Pipesの補完は同期実行できるExpressワークフローに限定した。
- WAFの個別ルールの計測、Firewall ManagerのOU・例外スコープ、DNSの拒否と監査、Fargate上のIRSAを独立した判断にした。CloudFormationの条件付き置換とLambdaの非同期処理では、変更・失敗をどの段階で観測できるかを明記した。

139問のうち独立した候補は133問。分野順に30・31・29・22・21問で、必要な残りは65・64・26・33・54問。

- [AWS Database Savings Plans](https://aws.amazon.com/savingsplans/database-pricing/)
- [AWS Data Exportsの分割コスト配分](https://docs.aws.amazon.com/cur/latest/userguide/enabling-split-cost-allocation-data.html)
- [AWS Glueのジョブブックマーク](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)
- [AWS WAFのルールアクション上書き](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-rule-group-override-options.html)

### レジリエンス・移行の追加7問

AS2受信時の署名と受領通知、仮想テープの再取得、Spotの中断前の代替起動、EC2基盤障害時の識別子維持、Valkeyのリージョン昇格、PostgreSQLの論理複製とDDL、SQSの再投入先と速度を確認した。SpotとEC2の復旧については代替の成功を保証しない。Valkeyのリージョン昇格は利用者の操作、RDSの劣化した検証環境は正本をもとに再作成という条件にした。

146問のうち独立した候補は140問。分野順に30・31・29・29・21問で、必要な残りは65・64・26・26・54問。

- [EC2 Auto ScalingのCapacity Rebalancing](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-capacity-rebalancing.html)
- [ElastiCache Global Datastoreの制約](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Redis-Global-Datastores-Getting-Started.html)
- [RDS Blue/Greenの制約](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-considerations.html)
- [SQSのデッドレターキューのリドライブ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-dead-letter-queue-redrive.html)

### 分散アプリ設計・セキュリティ・運用の追加15問

クラウド設計7問、セキュリティ4問、運用4問を追加した。ECS Service Connectのプロキシと単純なサービス検出、EKSの独自AMI、Distributed Mapの並列度と失敗比率、WebSocketの失効済み接続の扱いを確認した。DynamoDBの書き込み分散は点読みの要件から解く。GSIの別問はプロビジョンド容量不足の診断に絞り、キー再設計を問う問題と分けた。PrivateLinkではリージョン間アクセスの提供側と利用側の条件を明記した。

セキュリティ・運用では、経路外のパケット観測、Detectiveのリージョン単位、シークレットの削除猶予、KMSの同一素材再取り込み、CloudFormationの置換拒否と旧リソース保持、ECSの異なる失敗条件、Automationの2段階同時実行制限、Lambdaの加重エイリアスを扱った。既出と同じVPC Latticeの選択やFIS停止条件は採用しなかった。

161問のうち独立した候補は155問。分野順に37・35・29・29・25問で、必要な残りは58・60・26・26・50問。新しい15問すべてについて、一次資料の該当箇所、正答の成立条件、各誤答が外れる条件を確認した。既存146問の内容を保持した。

- [Amazon ECS Service Connectの構成](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-connect-concepts.html)
- [DynamoDBのGSI書き込み制限](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/gsi-throttling.html)
- [PrivateLinkのリージョン間アクセス](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html)
- [Systems Manager Automationの複数アカウント・リージョン設定](https://docs.aws.amazon.com/systems-manager/latest/userguide/running-automations-multiple-accounts-regions.html)

### データ設計・アクセス制御・復旧の追加18問

クラウド設計5問、セキュリティ5問、コスト1問、レジリエンス7問を追加した。データ設計ではKinesisのシャード単位の専用帯域、Firehoseの動的パーティショニングの移行条件、Icebergの行更新、Glueの互換性確認の起点、Redshiftの共有許可と関連付けを検証した。コストではAthenaの結果再利用で許容する鮮度を設問に明記した。

アクセス制御ではOIDCロールの対象、S3バケットポリシーのAWSサービス例外、EFSアクセスポイントの限定、同一アカウントでのKMS権限委任、Security Lakeのカスタムソース形式を確認した。復旧ではRDSの時点復元と被害行だけの取り込み、AWS Backupのコピー先での復元方式、S3の複製遅延イベント、DMSの遅延の切り分け、DataSyncの全件検証、EFSの逆方向複製と書き込み再開、Amazon MQのフェイルオーバーを扱った。

179問のうち独立した候補は173問。分野順に42・40・30・36・25問で、必要な残りは53・55・25・19・50問。全18問で一次資料、正答の成立条件、各誤答が満たさない条件を確認し、既存161問を保持した。

- [Kinesisの拡張ファンアウト](https://docs.aws.amazon.com/streams/latest/dev/enhanced-consumers.html)
- [Glue Schema Registryの互換性モード](https://docs.aws.amazon.com/glue/latest/dg/schema-registry.html)
- [S3バケットポリシーの条件キー](https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html)
- [AWS Backupによるバックアップのコピー](https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-copy.html)

### ネットワーク・権限・運用の追加29問

クラウド設計6問、セキュリティ4問、コスト1問、レジリエンス3問、運用15問を追加した。接続と権限を別々に検証し、Transit Gatewayの静的経路、Client VPNの経路配布と認可、PrivateLinkのプライベートDNS、HTTP APIの固定キュー宛先を設問に反映した。Aurora Serverlessのリーダーは昇格順位とスケーリングを併せて問う。

IAMの最終アクセスに拒否された試行も入ること、Access Analyzerの参照ポリシー比較、既存S3 ACLの移行、組織バックアップポリシーを適用する側の前提、S3バケットキー移行時に新旧の暗号化コンテキストが必要なことを確認した。復旧問題ではRoute 53が評価できるアラームの種類、DynamoDB復元先のストリーム再構成、MySQLの計画昇格で複製を外す順序を確認した。

運用では、CodePipelineのステージ単位のキュー、CodeBuildのレポートとキャッシュ、Systems Managerの設定起点とカットオフ、SLOの分母、ECSの停止イベント、CloudWatchのメトリクスストリームとログ検索、AWS Batchのインデックス依存、DynamoDB Streamsの部分再試行、Database Insightsのロックツリー、AWS Healthのリージョン間重複処理、EMRの並行ステップ制約、CloudFormationの置換後のロールバック監視を採用した。

既出のMRAP設計と同じ選択になる草稿、リージョン間EFS複製を選ぶだけの草稿、現在のCloudTrail Lakeの新規利用を前提とする草稿は採用しなかった。既存179問を保持し、新規29問の正答条件・誤答根拠・出典29件を確認した。208問のうち独立した候補は202問。分野順48・44・31・39・40問、公開に必要な残りは47・51・24・16・35問。

- [Transit Gatewayのピアリング](https://docs.aws.amazon.com/vpc/latest/tgw/tgw-peering.html)
- [IAM Access Analyzerのカスタムポリシーチェック](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-custom-policy-checks.html)
- [Route 53のヘルスチェックの設定値](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/health-checks-creating-values.html)
- [CodePipelineの実行モード](https://docs.aws.amazon.com/codepipeline/latest/userguide/concepts-how-it-works.html)
- [CloudWatch Logsのフィールドインデックス](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogs-Field-Indexing.html)
- [AWS CloudTrail Lakeの提供状況](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake-service-availability-change.html)

## SAP-C03のコンテナ・データ設計とセキュリティを14問追加

クラウド設計5問、セキュリティ9問を追加した。Fargateの画像変換領域はイメージ使用量を加算し、EKSは追加配置を妨げないAZ分散を問う。DynamoDBの同一項目に対する条件付きトランザクションとTTL削除の発生元、Auroraの同一リージョンでのコピーオンライトを確認した。

Cognitoの監査からの強制移行、CloudHSMキーストアとKMS操作の関係、S3 VPCアクセスポイントの権限委任、Configの監査集約とルール配布を区別した。CloudTrail Insightsでは書き込み管理APIとエラー頻度の違い、Security Hub CSPMでは検出更新と通知、Security Lakeではテーブル共有とデータ配信の違いを明記した。RDSのIAM認証は対象DBユーザーまで権限を絞り、Verified Permissionsは企業ごとに方針の管理単位を分けた。

既出のECS自動復帰・Fargate Spotの最小容量・Aurora I/O料金と同じ判断になる草稿は採用しなかった。既存208問を保持し、公開候補14問はAWS一次資料の該当箇所、正答の成立条件、各誤答が外れる理由を確認した。222問のうち独立した候補は216問。分野順53・53・31・39・40問で、公開に必要な残りは42・42・24・16・35問。

- [Amazon EKSのAZ分散](https://docs.aws.amazon.com/prescriptive-guidance/latest/ha-resiliency-amazon-eks-apps/spread-workloads.html)
- [DynamoDB StreamsとTTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-streams.html)
- [AWS CloudTrail Insights](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-insights-events-with-cloudtrail.html)
- [AWS Configの組織コンフォーマンスパック](https://docs.aws.amazon.com/config/latest/developerguide/conformance-pack-organization-apis.html)

## SAP-C03の設計・セキュリティ・コスト・復旧・運用を28問追加

クラウド設計6問、セキュリティ5問、コスト7問、レジリエンス3問、運用7問を追加した。API Gatewayの本文モデルとパラメータ、SNSのイベントIDと注文ID、EventBridgeのリプレイ対象、RDSの読み取り可能な待機系、Auroraの静的メンバーシップ、Direct Connectの許可プレフィックスを別々の判断として扱った。

セキュリティではECRのスキャンルールの優先、Lambda更新時の署名検証、CloudFrontとSSE-KMSの許可、IAM認証情報レポートに含まれない資格情報、バックアップ先で許可する操作を明記した。コストでは償却割引、推奨の参照期間、S3の取得料金と保存料金、Origin Shieldの費用差、EC2容量予約の空き枠、相互に排他的な削減、Lambdaのアーキテクチャ変更を確認した。

復旧ではOpenSearchフォロワーの書き込み切り替え、独立組織の承認経由でのバックアップ復元、FSxのエイリアスとKerberosを独立レビューした。運用では別リージョンのCodePipeline成果物、シークレット参照の取得時点、変更セットのドリフト復元、実利用者の計測、パッチのスキャンと適用、新着ログの集約と履歴移行、新規・既存アカウントのクォータを扱った。

既出のプライベートAPIのVPCE制限、RDSのIAM認証、送信元の境界設定と判断が重なる候補を見送った。既存229問の内容とID・改訂を保持し、新規28問の正答・誤答説明とAWS一次資料を確認した。257問のうち独立した候補は251問。分野順63・61・38・42・47問で、公開に必要な残りは32・34・17・13・28問。

- [Amazon Auroraのカスタムエンドポイント](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Endpoints.Custom.Considerations.html)
- [Amazon ECRのスキャンフィルター](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning-filters.html)
- [EC2の容量予約の請求](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/capacity-reservations-pricing-billing.html)
- [AWS Backupの復元に対する複数承認](https://docs.aws.amazon.com/aws-backup/latest/devguide/multipartyapproval.html)
- [AWS CloudFormationのドリフト考慮変更セット](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/drift-aware-change-sets.html)

## SAP-C03の設計・セキュリティ・コスト・復旧・運用を22問追加

設計6問では、EKSのクラスターAPIとサービスAPI、NLBのIPターゲット、同一AZのWindows共有ボリューム、S3のゾーン内作業領域、EFSの弾力的なスループット、Auroraの読み取り接続を扱った。セキュリティ3問ではSecrets Managerのポリシー保存時の検証、サービスとリージョンごとのFIPS対応、企業PKIの信頼アンカーを取り上げた。

コスト3問はRDS予約割引の正規化単位、S3アップロードの経路別加速、Regional NAT GatewayのAZ別料金とS3の経路を比較した。復旧3問はEBSの削除されたボリューム、Aurora MySQLのその場での巻き戻し、RDSのネイティブな別リージョン時点復元を区別した。運用7問では予測スケーリング、リリースのリビジョン、単発実行の整理と配信失敗、StackSetsからの離脱、起動前待機、配布前の構成検証、インスタンスごとのアラームを扱った。

既出と判断が重なる移行切り替え、OAC、ログマスキング、PrivateLinkの利用許可を除外した。Access Analyzerのカスタムポリシーチェックでは組織の構成員かどうかを確認できないため、その前提の案も除外した。S3 Object Lambdaについては新規利用の制限を確認し、新規導入の案を見送った。既存257問のID・改訂・内容を保持した。追加後は279問、独立した候補273問。分野順69・64・41・45・54問で、必要な残りは26・31・14・10・21問。

- [EKSのKubernetes APIエンドポイント](https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html)
- [IAM Roles Anywhereの信頼モデル](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/trust-model.html)
- [Regional NAT Gatewayの料金](https://aws.amazon.com/vpc/pricing/)
- [RDSの複製バックアップから時刻を指定した復元](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/AutomatedBackups.PiTR.html)
- [CloudWatchの複数時系列アラーム](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/multi-time-series-alarm.html)
- [EventBridge Schedulerの配信失敗キュー](https://docs.aws.amazon.com/scheduler/latest/UserGuide/configuring-schedule-dlq.html)

## SAP-C03の設計・セキュリティ・コスト・復旧・運用を26問追加

設計7問ではGlobal Acceleratorのリージョン配分、ポート変換とヘルスチェック、接続アフィニティ、Route 53 Profilesの関連付け優先度、ALBの複合条件とHost保持、PostgreSQLのRDS Proxy初期化を区別した。セキュリティ6問は、エージェントレスの評価範囲、AWS Configの記録と定期評価、IAMの組織パス、EKSの監視対象選択、Macieの解析範囲と既存統計、OU異動後の継承ドリフトを扱った。

コスト5問はSavings Plansの時間別購入試算、短命T3の余剰クレジット、Kinesisのアカウント単位の最低利用量、予算の承認とSCP適用、Redshiftの計算とストレージの分離を比較した。復旧2問はRDSの切り替え後の旧インスタンスとDRSのオンプレミスへのフェイルバックを確認した。運用6問はCloudFormationの初回ロールバック、ECSの試験リスナー、Glueの再処理範囲、暗号化AMIの所有権、Step Functionsの進捗と総時間、SNS FIFOの購読単位の追いつきを取り上げた。

Route 53 Profilesの優先度は100〜9900、AWS Configの定期評価は最長24時間間隔であり、範囲外の草稿を修正した。アフィニティの設問では、エッジロケーションの切り替えで別リージョンが選ばれる場合の例外を明記した。既出のARCの安全なルーティング切り替えとS3 RTCの遅延通知を再採用しなかった。既存279問のID・改訂・内容を保持した。追加後は305問、独立した候補299問。分野順76・70・46・47・60問で、必要な残りは19・25・9・8・15問。

- [Route 53 Profilesの優先順位](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/profiles.html)
- [Control Towerのコントロール継承ドリフト](https://docs.aws.amazon.com/controltower/latest/userguide/governance-drift.html)
- [Savings Plansの購入分析](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-purchase-analysis.html)
- [オンプレミスへのフェイルバック](https://docs.aws.amazon.com/drs/latest/userguide/failback-performing.html)
- [AWS Glueのジョブブックマーク](https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html)

## SAP-C03の設計・セキュリティ・コスト・復旧・運用を26問追加

設計4問は、同じキーに集中するKinesisの書き込みと注文内の順序、S3アクセスポイントのSDK用エイリアスとIAM用ARN、SQS FIFOの順序と並列性、VPC Latticeのサービスネットワークと個別サービスの認証境界を扱った。セキュリティ7問は、外部キーストア切断とデータキー再利用、証明書の全対象名のDNS検証、AWS ConfigのグローバルIAM記録、CSPM検出結果の集約と既存データの扱い、Cognito V1_0でアクセストークンのグループだけを上書きできる境界、グラントのコンテキストの部分集合、既存CloudTrail Lake顧客の追加アカウントを確認した。

コスト5問は、配分タグの過去の有効化、DynamoDBのインデックスの読み取り上限、GlueのDPU計測と履歴ファイルの保持、CodeBuildの予約フリートの余剰処理を取り上げた。復旧3問は、復元結果を記録する検証時間、AMIの更新失敗からの自動ロールバック、DMSで事前ロードしたPostgreSQLの変更取得を比較した。運用7問はスタック再編、パラメータの版ラベル、失敗したロールバックの続行、CodeBuildの依存関係、Resource Explorerの集約ビュー、変換後のログの転送、CloudWatchの非連続な超過判定を扱った。

S3所有権、EKSのAZ分散、Auroraの昇格優先順位をもう一度問う案は見送った。既存305問のID・改訂・内容を保持した。追加後は331問、独立した候補325問。分野順80・77・51・50・67問で、必要な残りは15・18・4・5・8問。

- [VPC Latticeの認証と認可](https://docs.aws.amazon.com/vpc-lattice/latest/ug/auth-policies.html)
- [グラントの暗号化コンテキスト制約](https://docs.aws.amazon.com/kms/latest/developerguide/create-grant-overview.html)
- [CloudTrail Lakeの提供範囲](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake-service-availability-change.html)
- [DynamoDBのオンデマンド最大スループット](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode-max-throughput.html)
- [AWS Backupの復元テスト検証](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing-validation.html)
- [CloudFormationスタックリファクタリング](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-refactoring.html)

## SAP-C03の設計・セキュリティ・コスト・復旧・運用を31問追加

設計6問では、単発ECSタスクのブロックデータ保持、EKS Fargateの静的EFS、API Gatewayのゾーン頂点と外部JWT、Greengrassでの切断時の保全、重複するプライベートDNSを扱った。セキュリティ8問は、組織証跡の所有と委任、引き受け先のSTSリージョン、有効なSAMLメタデータ、Private CAの発行制限、外部証明書の再インポート、RCPによるリソース側の上限、KMSのリージョン別認可、記録できる管理セッションの制限を確認した。

コスト4問は、S3の未完了パート、Lambdaの事前容量、Fargateの課金時間と追加ストレージ、RDSの一時停止を比較した。復旧5問では、DNS切り替え後の既存接続、OpenZFSのクローン、Valkeyのシャード単位の試験、S3の一時復元と復元完了通知、他リージョンにコピーしたAWS Backupからの復元を区別した。運用8問は、CodePipelineの対象実行、Map出力の保存、メトリクス学習の除外、指定版のS3オブジェクトの監査、アラームアクションの抑止、キューの配信時フィルター、Systems Managerの管理権限、ステートマシンのバージョン追跡を取り上げた。

既出のECS Service Connectによるサービス発見をもう一度問う案と、EFSを複数タスクへ共有するだけの案は採用しなかった。既存331件のID・改訂・内容を保持した。追加後は362問、独立した候補356問。分野順86・85・55・55・75問で、必要な残りは設計9問とセキュリティ10問。

- [ECSタスク用EBSボリューム](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ebs-volumes.html)
- [CloudTrail組織証跡の委任管理](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-delegated-administrator.html)
- [AWS Fargateの課金](https://aws.amazon.com/fargate/pricing/)
- [AWS BackupのS3復元](https://docs.aws.amazon.com/aws-backup/latest/devguide/restoring-s3.html)
- [CloudWatchアラームアクションの抑止](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarm-suppression.html)

## SAP-C03の設計・セキュリティを19問追加

設計9問では、索引を複製しないOpenSearchの横断検索、PrivateLinkの接続元識別、公開と非公開のREST APIの名前解決、FSxの内容解放、LatticeのTCPリソース、API Gatewayの応答変換、S3 Expressの並行追記、Auroraの書き込み転送、DynamoDBのスパースインデックスを扱った。

セキュリティ10問では、EKSのAPIデータ暗号化、S3 Object Lockのリーガルホールド、CloudFrontの条件付き署名CookieとオリジンのTLS、Verified Accessの共通方針と追加条件、RDSのCA移行、S3の検知と監査、CloudWatch Logsのキー切り替え、DNSSECの親ゾーンへの登録、Identity CenterのSCIMとSAMLを扱った。

既出のSecurity Lakeの購読者設定と、WAFのCountを中心とする試験案は採用しなかった。Latticeのゲートウェイとリソース設定は両方を選ぶ5択にした。公開APIの名前解決、CloudFront署名CookieのIPv4条件、RDSの対象エンジンは設問内で前提を明記した。既存362件のID・改訂・内容を保持した。追加後は381問で、類似グループごとに数えた独立候補は375問。分野別に95・95・55・55・75問あり、75問ずつ重複のない模試5回分を構成できる。

- [VPC Latticeのリソース設定](https://docs.aws.amazon.com/vpc-lattice/latest/ug/resource-configuration.html)
- [PrivateLinkの接続元情報とProxy Protocol v2](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/edit-target-group-attributes.html)
- [Aurora MySQLのグローバル書き込み転送](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-write-forwarding-ams.html)
- [CloudWatch LogsのKMS暗号化とキーの関連付け](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)
- [DNSSECの署名と親ゾーンとの信頼関係](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html)
- [IAM Identity CenterのSCIMプロビジョニング](https://docs.aws.amazon.com/singlesignon/latest/userguide/provision-automatically.html)

## SAA-C03の4分野に37問追加

セキュリティ11問は、DNS Firewallと問い合わせ記録、ECRの継続スキャン、PostgreSQLのTLSとIAM認証、EFSの転送時保護、Roles Anywhere、企業IDでのS3 Access Grants、Cognitoの適応認証、CloudWatch LogsのKMS、Vault Lock、ACMへの再インポートを扱う。

レジリエンス6問は、EFSの復元テスト、Auto ScalingのAZ再均衡、S3 RTCの時間と通知、SQSのデッドレターキューからの再処理、RDS Multi-AZ DBクラスター、EventBridgeのリージョン切り替えを比較する。パフォーマンス7問は、Origin Shield、Valkeyの読み取りエンドポイント、SQSのロングポーリング、EFSのElastic Throughput、EC2の近接配置、S3の並列書き込み、NLBのクロスゾーン負荷分散を扱う。

コスト最適化13問では、Lambdaの実測GB秒、EFSのライフサイクル、DynamoDBのテーブルクラス、RDSの停止時間、AWS Backupの保管期間、EC2のメモリメトリクス、S3の非現行版とRequester Pays、EC2のリージョン予約、CloudFrontの料金クラス、CloudWatch LogsのEssentials、OpenSearch UltraWarm、API GatewayのHTTP APIを比較した。

RDS Proxy、Kinesisの専用読み取り帯域、主要キーの分散、書き込みを伴う再試行の冪等性、S3の所有権、WAF、Session Managerの候補は、既存設問と判断が重なるため見送った。S3 RTCは請求期間・リージョンペアごとのSLAを根拠にした。CloudWatch LogsのEssentialsには旧名Infrequent Accessも併記した。

既存65問のID・改訂・内容を保持した。模試の候補は独立102問。セキュリティ30／95、レジリエンス23／85、パフォーマンス23／80、コスト最適化26／65で、残りは223問。演習の「第1回」は従来の65問を維持し、新規分はランダム出題と時間制限付き模試から出題する。

- [SAA-C03試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)
- [S3 Replication Time ControlのSLA](https://aws.amazon.com/s3/sla-rtc/)
- [AWS Backupの保持期間](https://docs.aws.amazon.com/aws-backup/latest/devguide/plan-options-and-configuration.html)
- [NLBのクロスゾーン負荷分散](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/edit-target-group-attributes.html)
- [CloudWatch Logsのログクラス](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatch_Logs_Log_Classes.html)
- [Amazon Cognitoの適応認証](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-adaptive-authentication.html)

## SAA-C03にさらに37問追加

セキュリティ9問では、VPC Flow Logsの受理・拒否、S3 Bucket Key、IAMの許可境界、CloudTrail証跡の識別、JWTの更新スコープ、Security Hub CSPMの中央設定、Access Analyzerの信頼ゾーン、ACMのDNS検証、RDSの保存時暗号化移行を扱った。

レジリエンス9問では、Auto Scalingの更新チェックポイントと起動フック、DynamoDB復元後のTTL・Streams、SQSの可視性延長、RDSのクロスリージョン自動バックアップ、AWS Backupの宛先ボールト許可、Route 53のマルチバリュー回答、ECRの複製ルールとバックフィル、SNSとSQSの個別キューを比較した。既出のALB登録解除と重なる候補を除き、DynamoDBは時点の選択ではなく復元後のテーブル設定を問うようにした。

パフォーマンス9問は、DAX、SQSからのLambda同時実行上限、Athenaのパーティション射影、ENA Express、インスタンスのEBS帯域、Redshiftの同時実行、Aurora MySQLのパラレルクエリ、EBSの初回読み取り、ECSのターゲット追跡を扱った。コスト最適化10問は、EBS HDDの基準帯域、Aurora I/O-Optimized、CloudFrontの圧縮、支出の異常検出、FargateのARM64化、S3の小さいファイルの移行とStorage Lens、DynamoDB TTL、コスト配分タグ、EBSスナップショットのアーカイブを比較した。

既存102問のID・改訂・内容を保持した。独立候補は139問。セキュリティ39／95、レジリエンス32／85、パフォーマンス32／80、コスト最適化36／65で、残りは186問。

- [IAMのアクセス許可境界](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)
- [DynamoDBのテーブル復元と再設定](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/pointintimerecovery_restores.html)
- [Auto Scalingのインスタンスリフレッシュのチェックポイント](https://docs.aws.amazon.com/autoscaling/ec2/userguide/asg-adding-checkpoints-instance-refresh.html)
- [ECRのリージョン間レプリケーション](https://docs.aws.amazon.com/AmazonECR/latest/userguide/replication.html)
- [Athenaのパーティション射影](https://docs.aws.amazon.com/athena/latest/ug/partition-projection.html)
- [S3 Lifecycleのストレージ移行](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html)

## SAA-C03の4分野に40問追加

セキュリティ12問は、S3の公開抑止、暗号化EBSスナップショットの共有、Parameter Storeの復号権限、CloudFrontのビューワー側HTTPS、ALBを起点にしたセキュリティグループ参照、GuardDutyの有効化、Configの構成集約、IMDSv2、KMSのリージョン別認可、Cognitoの公開クライアント、ネットワーク検査、Configの自動修復を扱った。

レジリエンス9問は、EFSのフェイルバック、EC2のスタンバイ、Auroraの昇格優先順位、ALBのスロースタート、S3の削除マーカー、Lambdaの非同期失敗記録、EBSの別AZへの復元、Fargateの再均衡に必要な起動枠、Step Functionsの実行再開を比較した。

パフォーマンス8問では、Valkeyの書き込み分割、API Gatewayの参照用POSTだけのキャッシュ、S3の範囲読み取り、Kinesisのオンデマンド、EFSのパフォーマンスモード、Redshiftの分散キー、Glueのジョブブックマーク、SQSのバッチ送信を扱った。コスト最適化11問では、IPv6の外向き接続、EC2終了時のEBS削除、Glacier Instant Retrieval、オンデマンドとSpotの配分、ECSのタスク集約、ECRのアーカイブ、Aurora Serverlessの休止、Glue Flex、SNS購読の本文フィルター、CloudWatchメトリクスの次元、DynamoDBの予約容量を比較した。

CloudFront圧縮、Lambdaのプロビジョンド同時実行、S3 Transfer Accelerationは既出設問と判断が重なるため採用しなかった。既存139問のID・改訂・内容を保持し、独立候補は179問になった。セキュリティ51／95、レジリエンス41／85、パフォーマンス40／80、コスト最適化47／65で、残りは146問。

- [EBSスナップショットの共有](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-modifying-snapshot-permissions.html)
- [EFSレプリカからの復帰](https://docs.aws.amazon.com/efs/latest/ug/replication-fail-over.html)
- [ECSのAZ再均衡](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-rebalancing.html)
- [API GatewayのREST APIキャッシュ](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-caching.html)
- [Redshiftの分散キー](https://docs.aws.amazon.com/redshift/latest/dg/c_best-practices-best-dist-key.html)
- [Aurora Serverlessの自動休止](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html)

## SAA-C03の4分野に41問追加

セキュリティ10問では、IAM Identity Centerの外部グループ、ALBの相互TLS、S3の既定暗号化とVPCアクセスポイント、EventBridgeからのECSロール受け渡し、Client VPNのグループ認可、WAFのボット分類、ECRの非公開接続、シークレットポリシーの事前検証、KMSキーの再有効化を扱った。

レジリエンス11問では、Elastic Beanstalkのイミュータブル更新、Step Functionsの版別ルーティング、Route 53の重み0の待機先、EBS Recycle Bin、AuroraのBacktrack、EC2のホスト復旧、ECS更新中の業務アラーム、DRSの訓練、S3のレプリカ変更同期、Amazon MQの切り替え、CloudFormationの削除時スナップショットを比較した。

パフォーマンス13問は、RDSのOS監視、ValkeyのGlobal Datastore、S3のマルチリージョンアクセスポイントとExpress One Zone、CloudFrontのKeyValueStoreとWebSocket、Lambda SnapStart、Redshiftのマテリアライズドビュー、Auroraの用途別エンドポイント、DynamoDBの空ページ、EC2の基準帯域、ECSのクラスター容量、Kinesisの再処理範囲を扱った。コスト最適化7問では、T3のクレジット、X-Rayの抽出率、AWS Budgetsの予測通知、S3 One Zone-IA、IPAMの未関連IP、データベース向けSavings Plans、Dedicated Hostsの物理ライセンス条件を比較した。

Secrets Managerの候補は、既出のクロスアカウント暗号化権限と重ならないよう、リソースポリシーの適用前検証に変更した。Kinesisの部分失敗は報告機能の選択でなく、最小の失敗シーケンスから続く再処理範囲を問う。S3のレプリカ変更同期では両方向の設定を条件にした。

既存179問のID・改訂・内容を保持し、独立候補は220問。セキュリティ61／95、レジリエンス52／85、パフォーマンス53／80、コスト最適化54／65で、残りは105問。

- [S3レプリカのメタデータ変更の同期](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-for-metadata-changes.html)
- [AWS KMSキーの削除取り消し](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys-cancelling-key-deletion.html)
- [Kinesisの部分バッチ応答](https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html)
- [Auroraのカスタムエンドポイント](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Endpoints.Custom.html)
- [AWS Budgetsの予測通知](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html)

## SAA-C03の4分野に46問追加

セキュリティ15問では、委託先ロールのExternal ID、EKS Pod IdentityとIRSAの前提、API Gatewayの相互TLSを適用する入口、IAMポリシー生成で拾えないPassRole、CloudTrailの署名付きダイジェスト、マスク済みログの閲覧権限などを確認した。プライベートCAは既出のALBによるクライアント認証との重複を避け、管理対象端末からサーバーのCAチェーンを検証する設問にした。

レジリエンス16問では、Aurora Global Databaseの計画切り替え、RDSブルー/グリーン切り替えのタイムアウト、AWS DMSのフルロードとCDC、ECSの処理中タスク保護、EventBridgeのルールを限定した再送、仮想プライベートゲートウェイでの最長一致、DynamoDBの複数項目の原子的な更新などを扱った。既出の専用線冗長化に対して、今回は専用線とVPNを設置済みとし、広告するプレフィックスの長さによって平時の経路が決まる前提を明示した。

パフォーマンス11問では、AWS Batchの配列間依存、RDS Proxyの共通初期化クエリ、Amazon EMRの初回起動でのSpot調達タイムアウト、AWS GlueのR.1X、DynamoDBの強整合LSI、SQSの処理時間から求めるワーカー当たりの滞留件数などを扱った。コスト最適化4問は、Savings Plansの使用率、CUR 2.0のリソースID、作り直せるデータのインスタンスストア、Athenaの結果再利用を扱った。

既存220問と固定の第1回を保持した。追加46問の全184選択肢について正誤と解説を確認し、独立候補は266問になった。セキュリティ76／95、レジリエンス68／85、パフォーマンス64／80、コスト最適化58／65で、残りは59問。65問・130分の模試4回分を実際の模試生成処理で構成し、260件の類似グループが回をまたいで重複しないことを確認した。通常生成512回では所定の分野配分と重複排除を満たし、全266問が抽選された。

- [IAMポリシー生成の対象と制約](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
- [RDSブルー/グリーンデプロイの切り替え](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-switching.html)
- [ECSタスクのスケールイン保護](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-scale-in-protection.html)
- [AWS Batchの配列ジョブ](https://docs.aws.amazon.com/batch/latest/userguide/array_jobs.html)
- [Athenaの結果再利用](https://docs.aws.amazon.com/athena/latest/ug/reusing-query-results.html)

## SAA-C03の4分野に35問追加

コスト最適化7問では、EC2休止中の課金、Redshiftのマネージドストレージ、DMS Serverlessの稼働容量、Bedrockバッチ推論、共通費用の固定按分、共有EC2キャパシティ予約の未使用分の課金、CloudFrontのアセット更新を扱った。費用のレポート内での配賦と、AWSが未使用容量を請求するアカウントの変更を区別した。

セキュリティ10問では、KMSグラントの暗号化コンテキスト、EBSの既定暗号化、WAFのトークンドメイン、KMSの署名、Lambda関数URLのオリジン認証、RDSの管理対象シークレット、ECRの不変タグの例外、ACM証明書のエクスポート、RCP、HTTP APIのルート別の認可キャッシュを扱った。

レジリエンス9問では、ARCのアサーションルール、SNSの購読単位の失敗隔離、DynamoDBのMRSC、ECSローリング更新の整数枠、EFSの項目単位の復元、S3の条件付き書き込み、パスワード更新時の交互ユーザー、EC2のウォームプール再利用、CloudFormationの置き換え防止を確認した。パフォーマンス9問では、RDSの専用ログボリューム、SQSの専用ポーラー、ALBのクライアント側HTTP/2とターゲット側gRPC、OpenSearchのシャード数、Kinesisのハッシュ範囲、DynamoDBの事前容量、Lambdaの閉域ストリーミング、NLBの変換ポートを比較した。

既存266問と固定の第1回を保持した。既出のS3 Batch Replication、EventBridgeのグローバルエンドポイント、Redshiftの同時実行スケーリングの草稿は、既出と同じ判断を問うため採用しなかった。追加35問の全140選択肢の正誤と解説を確認し、独立候補は301問。分野別はセキュリティ86／95、レジリエンス77／85、パフォーマンス73／80、コスト最適化65／65で、コスト最適化は5回分に達した。残りは9・8・7・0問。

- [EC2キャパシティ予約の未使用分の課金割り当て](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/assign-billing.html)
- [KMSグラントの制約](https://docs.aws.amazon.com/kms/latest/APIReference/API_GrantConstraints.html)
- [DynamoDBのグローバルテーブルと整合性](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html)
- [ECSのタスク置き換えと丸め](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)
- [SQSイベントソースマッピングのスケーリング](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-scaling.html)

## SAA-C03の独立した325問を確認

セキュリティ9問では、証明書の失効とOCSP、Macieのカスタム識別子、CloudTrail InsightsのAPIエラー率、Object Lockのリーガルホールド、STSのセッションタグとポリシー、CloudFrontのフォーム項目の暗号化、WAFのルール単位のCount、S3のアカウント単位の公開ブロックを扱った。WAFはグループの返却結果をCountへ変更する場合と、内部のルールを一つずつCountにする場合の評価範囲を区別した。

レジリエンス8問では、復旧リージョンのシークレットの昇格、CloudFormationの配備後の監視、FIFOのグループ単位の重複排除、EC2の停止保護、DRSの時点指定、Lambda非同期イベントの期限、Global Acceleratorの新規接続の切り替え、NLB不健全ターゲットのドレインを確認した。NLBでは、登録解除を伴わず、不健全時の接続終了を無効にしてドレイン時間を設定する条件を明示した。

パフォーマンス7問では、Fargateの対応サイズ、Kinesisのシャード内のLambda並列処理、CloudWatchの全実測値からのp99、Valkeyの読み取り接続、FSxのSSD IOPS、ActiveMQの接続再利用、RDSの割当ストレージの自動拡張を扱った。

既存301問と固定の第1回を保持した。追加24問の全96選択肢の正誤と解説を照合し、AWS一次資料24件への到達を確認した。独立候補の分野別内訳は95・85・80・65問。公開検査で各分野の5倍を満たし、模試生成処理で65問・130分、各回19・17・16・13問の5回分を組み、計325の類似グループが回をまたいで重複しないことを確認した。通常の模試生成512回でも各回の配分と重複排除を検証し、325問すべてが抽選された。

- [AWS WAFのルールアクション上書き](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-rule-group-override-options.html)
- [Secrets Managerレプリカの昇格](https://docs.aws.amazon.com/secretsmanager/latest/userguide/standalone-secret.html)
- [NLBの不健全ターゲットのドレイン](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/edit-target-group-attributes.html)
- [LambdaのKinesisストリーム処理](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html)
- [CloudWatchのパーセンタイル用データ](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricData.html)

## CLF-C02で65問・90分の模試1回分を構成

AWSの試験案内とCLF-C02の試験ガイドを確認した。4分野を16・19・22・8問に配分し、既存の10問に新規の56問を追加した。既存の責任共有の2問は同じ類似グループとして引き続き扱う。登録は66問、模試候補は65グループで、追加はクラウドの概念15問、セキュリティとコンプライアンス17問、クラウド技術とサービス20問、請求と料金とサポート4問。

クラウドの概念では、伸縮性とアジリティ、変動費と規模の経済、移行の依存関係、CAFとWell-Architected、復旧目標と復元テスト、不要データの削除を扱った。セキュリティでは、IAMの認証と認可、Organizationsの権限制御、通信中と保存後の暗号化、AWSの監査文書と自社環境の構成評価、GuardDuty・Inspector・Macieの役割などを比較した。技術とサービスの設問は、用途別のDB、ブロック・共有ファイル・アーカイブの選択、VPC・DNS・CDN、キューと通知、計算基盤、分析とAIの使い分けを扱った。請求の設問では費用の実績分析、計算サービスを横断する割引、請求タグの有効化、見直し候補の取得を扱った。

追加分は単一選択53問、複数選択3問。AWSの一次資料56件と全227選択肢を照合し、採点の組み合わせ944通りを確認した。実際の模試生成を512回試し、毎回65問・90分、分野配分16・19・22・8、類似グループ内の重複なしを確認した。5回分の条件にはあと260グループが必要で、内訳は64・76・88・32問。

- [AWS Certified Cloud Practitionerの試験案内](https://aws.amazon.com/certification/certified-cloud-practitioner/)
- [CLF-C02試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html)
- [CLF-C02の範囲に含まれるAWSサービス](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/clf-02-in-scope-services.html)

## CLF-C02で重複のない模試2回分を構成

既存66問と固定の第1回を保持し、クラウドの概念16問、セキュリティとコンプライアンス19問、クラウド技術とサービス22問、請求と料金とサポート8問を追加した。登録は131問、類似グループで数えた独立候補は130問。各分野の独立候補は32・38・44・16問で、5回分の条件まであと48・57・66・24問。

概念では障害の影響範囲、耐久性と可用性、移行方式、サービス成果あたりの資源利用を扱った。セキュリティでは、IAM権限の変更前評価と外部共有の検出、実際のIP通信ログとAWS APIのログ、証明書の自動更新、CSPMの標準別チェックを区別した。技術とサービスでは、AWS Backupによる実行頻度と保持の設定、既存ファイル共有からの定期転送とS3を使うファイル共有、EKSの運用責任、ストリームの再読み込みを比較した。請求と料金では、予算しきい値と利用傾向からの逸脱、ゾーンのリザーブドインスタンス、データ転送と保存容量の費用を確認した。

単一選択60問、複数選択5問の全265選択肢をレビューし、採点の組み合わせ1,120通りを確認した。本番と同じ65問・90分の模試を2回分組み、どちらも分野配分が16・19・22・8問で、2回間で類似グループが重複しないことを確認した。通常の抽選も512回試し、既存分を含む131問すべてが出題された。

- [AWSの障害分離と影響範囲](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel10-bp03.html)
- [DNS検証によるACM証明書の自動更新](https://docs.aws.amazon.com/acm/latest/userguide/dns-renewal-validation.html)
- [Security Hub CSPMのセキュリティ標準](https://docs.aws.amazon.com/securityhub/latest/userguide/standards-view-manage.html)
- [AWS Backupのバックアッププラン](https://docs.aws.amazon.com/aws-backup/latest/devguide/about-backup-plans.html)
- [AWS DataSync](https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html)
- [Amazon S3 File Gateway](https://docs.aws.amazon.com/filegateway/latest/files3/what-is-file-s3.html)
- [Amazon EBSの料金](https://aws.amazon.com/ebs/pricing/)

## CLF-C02で重複のない模試3回分を構成

既存131問と固定の第1回を保持した。クラウドの概念16問、セキュリティとコンプライアンス19問、クラウド技術とサービス22問、請求と料金とサポート8問を追加した。登録196問に対し、独立候補は195問。分野別では48・57・66・24問となり、5回分の条件まで残り32・38・44・16問。

既存設問と判断が重なる草稿は差し替えた。今回は、移行の判断と切り戻し条件、CAFの段階、コードとしての運用、複数AZにまたがるAuroraのストレージ、分析と可視化、リリース工程の管理を追加した。セキュリティではIAMの明示拒否とネットワークACLの番号順評価、S3の読み書きに関する監査、鍵の所有形態とローテーションを区別した。請求とサポートでは、短期の容量確保と使用額割引、ストレージの保持期間と取り出し料金、保守の影響を受けるリソースの確認を扱った。

単一選択61問、複数選択4問の計264選択肢をレビューし、65問に記載したAWS一次資料に到達できることと、採点1,104通りを確認した。65問・90分の模試を分野配分16・19・22・8問で3回分組み、累計195の類似グループが回をまたいで重複しないことを確認した。通常の抽選512回では、既存分を含む196問すべてが出題された。

- [AWS CAFの変革段階](https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-cloud-operating-model/com-journey.html)
- [移行の切り替え段階](https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-migration-cutover/cutover-stage.html)
- [AWS KMSのキーローテーション](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)
- [Auroraの高可用性](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.AuroraHighAvailability.html)
- [AWS CodePipeline](https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html)
- [EC2オンデマンドキャパシティ予約](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html)

## CLF-C02で重複のない模試4回分を構成

既存196問と固定の第1回を保持し、クラウドの概念16問、セキュリティとコンプライアンス19問、クラウド技術とサービス22問、請求と料金とサポート8問を追加した。登録261問に対し、独立候補は260問。分野別の候補は64・76・88・32問で、5回分まで残り16・19・22・8問。

既存問と判断が重なった草稿は差し替えた。概念では業務の成功率、復旧先のクォータ、フェイルバック時のデータ同期、作業手順と障害調査を扱った。セキュリティでは付与済み未使用アクセス、KMSキーポリシー、バックアップの保持条件、CloudTrailのログ整合性、Shield Advancedの支援と料金保護を区別した。技術ではEFSの初回再アクセスによる保管クラス移行、SQSの処理猶予と失敗の隔離、ECSのタスク定義、分散トレースを扱った。請求では予算超過後の承認、物理ソケット単位のライセンス、部門別の承認済み製品の調達を確認した。

単一選択60問、複数選択5問の全265選択肢をレビューした。追加65問の一次資料への到達と採点1,120通りを確認した。分野配分16・19・22・8問の65問・90分の模試を4回分組み、全260グループに重複がないことを検証した。通常の抽選512回では、既存分を含む261問すべてが出題された。

- [復旧先のクォータの余裕](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel01-bp06.html)
- [AWS Backup Vault Lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html)
- [CloudTrailのログファイル整合性検証](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [SQSの可視性タイムアウト](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [EFSのライフサイクル管理](https://docs.aws.amazon.com/efs/latest/ug/lifecycle-management-efs.html)
- [AWS Budgetsアクションの承認](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-action-review.html)

## CLF-C02の独立325問を確認

既存261問と固定の第1回を保持し、クラウドの概念16問、セキュリティとコンプライアンス19問、クラウド技術とサービス22問、請求と料金とサポート8問を追加した。登録326問、類似グループを除いた独立候補は325問。各分野は80・95・110・40問で、全分野が本試験の分野配分の5倍を満たす。

今回は、再試行の上限、合成監視、データ分類、組織全体の監査、KMSなどの権限と資源側の上限、S3ゲートウェイ型エンドポイント、EC2ハイバネーションで保持する状態、CloudWatchの複数アラームやログの扱い、RIのサイズ柔軟性、予算額に対する予測通知、タグのバックフィルなどを扱った。既存と同じ判断の草稿は、疎結合、PaaS、API操作履歴からのIAMポリシー案の生成など、独立した題材に入れ替えた。

追加分の単一選択60問、複数選択5問について、計265選択肢とAWS一次資料65件を確認した。採点の組み合わせ1,120通りを検証した。65問・90分の模試を各回16・19・22・8問の配分で5回分組み、計325グループが回をまたいで重複しないことを確認した。通常の抽選512回では既存分を含む326問すべてが出題された。

- [AWS CLF-C02試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html)
- [合成監視](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html)
- [IAM Access Analyzerのポリシー生成](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
- [S3のVPCエンドポイント](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html)
- [EC2のハイバネーション](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Hibernate.html)
- [コスト配分タグのバックフィル](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-allocation-backfill.html)

## AIF-C01の回答形式と初回の追加問題

公式ガイドの並べ替え・組み合わせを各3問追加し、位置を持つ回答を採点・保存・再開時に扱えるようにした。既存10問のID、改訂、設問、選択肢を保持し、通常の複数選択は順不同で採点する。

AI・MLの基礎、生成AIの基礎、基盤モデルの応用、セキュリティとガバナンスの初回分として32問を追加した。モデルの対応形式を同じ判断で問う草稿、既出の更新情報に関する草稿、独立性または一次資料を再確認する推論・分類の草稿は採用していない。類似グループとIDの一意性、全選択肢の説明、採点データ、採用分のAWS一次資料への到達を確認した。

- [AIF-C01公式試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html)
- [Amazon Bedrock Knowledge Basesの検索設定](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html)
- [Amazon Bedrockの評価指標](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-metrics.html)

## AIF-C01の5分野に62問を追加

今の問題とは異なる判断を問う候補を追加した。AI・MLの基礎14問、生成AIの基礎10問、基盤モデルの応用13問、責任あるAI12問、セキュリティとガバナンス13問。合計は110レコード、類似グループを除いた独立候補は109問。全5分野の独立候補は29・26・22・15・17問になった。

類似した用途選定、同一の指標判断、既出のデータ分割の草稿は採用しなかった。誤答には別用途に使える機能や、条件を一部しか満たさない構成を置いた。新規62問について、採点の組み合わせ316通りと出典URL54件の到達を確認した。旧10問の内容と版を維持した。A2IとSageMaker Model Monitorについては、既に利用中の環境に前提を限定した。

- [AIF-C01公式試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html)
- [SageMaker Canvasでの特徴量変換](https://docs.aws.amazon.com/sagemaker/latest/dg/canvas-transform.html)
- [Amazon Bedrockのリージョン別モデル提供](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)
- [Bedrock Knowledge Basesのチャンク分割](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking.html)
- [Amazon A2IとTextractの確認条件](https://docs.aws.amazon.com/sagemaker/latest/dg/a2i-json-humantaskactivationconditions-textract-example.html)
- [Amazon S3のタグ条件付きアクセス](https://docs.aws.amazon.com/AmazonS3/latest/userguide/tagging-and-policies.html)

## AIF-C01を65問・90分に拡張する検証

5分野に37問を追加した。主な題材は、SageMakerの推論方式とデータ型、生成AIと業務システムの役割分担、RAGのクエリ分解と文書解析、既存のモデル成果物の取り込み、構造化された評価、人による判断、ガードレールの動作、データの系譜と監査。既出の検索、翻訳、データレジデンシー、モデルの提供終了と同じ判断を繰り返す草稿は除いた。新規設問の出典33 URLと採点150通りを検証した。

実際の配点は採点対象50問の比率として公開されているため、採点対象外を含む全65問へその比率を按分し、5分野を13・16・18・9・9問とした。旧版の設問には模試分野だけを追加し、ID・版・従来の学習カテゴリ・回答データを維持した。模試の公開条件は引き続き各分野5回分、合計325問。現在は146問なので作業ブランチで検証する。

- [AWS AI Practitionerの試験概要](https://aws.amazon.com/certification/certified-ai-practitioner/)
- [AWS AIF-C01の公式試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html)
- [Bedrock Knowledge Basesの取得設定](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html)
- [Bedrockの独立したガードレール評価](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-independent-api.html)
- [Bedrockのデータ保持モード](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)

## AIF-C01の5分野に32問を追加

AI・MLの基礎5問、生成AIの基礎7問、基盤モデルの応用9問、責任あるAI6問、セキュリティとガバナンス5問。独立候補は43・37・42・29・27問、計178問になった。

今回は、確率の校正とA/B評価、画像の部分編集と動画の生成、検索と引用の異なる評価指標、プロンプトの移植、ストリーミング前の出力検査、実データでの合成データの検証、識別情報を出さない共同分析を扱った。承認フロー、データの系譜、構造化結果の検査、取得フィルターの使い方は、同じ判断を問う既存の設問があるため追加しなかった。新規問題の採点162通りと29出典の到達を確認した。既存10問の設問・版・回答を保持。

- [Amazon Bedrockの検索・引用の評価指標](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-evaluation-metrics.html)
- [Amazon Nova 2 Sonicの発話割り込み](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-barge-in.html)
- [Amazon Bedrockのストリーミング出力の検査](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-streaming.html)
- [AWS Responsible AI Lensの合成データ品質検証](https://docs.aws.amazon.com/wellarchitected/latest/responsible-ai-lens/raidp02-bp04.html)
- [SageMaker Clarifyの学習後バイアス指標](https://docs.aws.amazon.com/sagemaker/latest/dg/clarify-measure-post-training-bias.html)

## AIF-C01に42問を追加し、模試3回分を検証

AI・MLの基礎8問、生成AIの基礎11問、基盤モデルの応用12問、責任あるAI5問、セキュリティとガバナンス6問。独立候補は51・48・54・34・33問、計220問。複数選択、順序、組み合わせを含めて、新規の採点222通りと37出典を確認した。

題材は、遅れて確定する実績と予測の照合、トークン枠と同時実行、生成結果を順次表示する方法、学習する重みを絞るLoRA、モデルの評価用入力とタスク、独立評価、カタログでのデータ利用承認、集計結果の最小人数制約など。新規利用の受付を終了したSageMaker ClarifyとGround Truthの機能を問う既存の作業ブランチ内の設問には、既存利用者の前提を明記した。公開済みの旧10問には変更を加えていない。

- [Bedrockのトークン割当管理](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html)
- [Bedrockのモデル評価タスク](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-tasks.html)
- [SageMaker Clarifyの機能と提供条件](https://docs.aws.amazon.com/sagemaker/latest/dg/clarify-post-training-bias-metric-ft.html)
- [SageMaker Ground Truthのラベル検証と調整](https://docs.aws.amazon.com/sagemaker/latest/dg/sms-verification-data.html)
- [AWS Clean Roomsの集計分析ルール](https://docs.aws.amazon.com/clean-rooms/latest/userguide/analysis-rules-aggregation.html)

## AIF-C01の5分野に30問を追加

AI・MLの基礎4問、生成AIの基礎6問、基盤モデルの応用9問、責任あるAI6問、セキュリティとガバナンス5問。分野別の独立候補は55・54・63・40・38問となり、計250問。新規152通りの採点と28件の一次資料の直接到達を確認した。

今回の題材は、希少故障の教師データと故障ごとの評価、発注に使う需要の上側、トークン枠の事前確認、完了した応答当たりの費用、既存検索索引とグラフの活用、文書の直接取込、利用者と運用担当者への透明性、画像付き入力の検査、学習コンテナの分離とコンテナの実行中の検知。モデル統合、バッチ推論、プロンプトキャッシュなど、既出の判断と重なる候補は追加しなかった。旧10問の内容・版を維持した。

- [Bedrock CountTokensの事前計測](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_CountTokens.html)
- [BedrockとNeptune Analyticsのグラフ検索](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs.html)
- [Bedrockのナレッジベースへの直接取り込み](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion-add.html)
- [Responsible AI Lensの透明性戦略](https://docs.aws.amazon.com/wellarchitected/latest/responsible-ai-lens/raigt01-bp01.html)
- [ECRでのAmazon Inspectorの継続スキャン](https://docs.aws.amazon.com/inspector/latest/user/scanning-ecr.html)

## AIF-C01に29問を追加し、模試4回分を検証

AI・MLの基礎3問、生成AIの基礎11問、基盤モデルの応用11問、セキュリティとガバナンス4問。分野別の独立候補は58・65・74・40・42問、合計279問。残りは分野別に7・15・16・5・3問。既存10問の内容と版は保持した。

追加分では、成約ラベルの定義と予測時点で使える情報、MCP経由の既存API利用、エージェントのセッション分離と長期メモリ、字幕の正確さを求める動画制作、検証損失による早期停止、自動採点の偏り、用語とデータ資産の対応付けを扱った。既出の教師あり調整や、情報不足時の応答に判断が重なる候補は今回の追加から外した。

新規118通りの採点、累計200件の参照先への直接到達、既存の自動検査を確認した。本番条件の65問・90分を512回実行し、分野別の配分を保った重複なしの4回を128組組めること、カスタムの全65件数、問題バンクの全280レコードが抽選対象になることを確認した。

- [AIF-C01の生成AI分野](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain2.html)
- [AgentCoreの長期メモリ戦略](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/long-term-configuring-built-in-strategies.html)
- [Bedrockのモデル調整時の早期停止](https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models-hp.html)
- [Bedrock自動評価で応答が不足した場合の確認](https://docs.aws.amazon.com/bedrock/latest/userguide/model-evaluation-report-programmatic.html)

## AIF-C01の独立325問と重複なしの模試5回分

AI・MLの基礎7問、生成AIの基礎15問、基盤モデルの応用16問、責任あるAI5問、セキュリティとガバナンス3問を追加した。既存の本番公開済み10問は、模試で使う分野情報を追加したほかは内容とリビジョンを保持した。生成AIの画像・動画関連の8問は、提供終了モデルに依存しない判断や、利用可能な画像機能を問う形に更新した。提供終了したモデルの技術資料を使う場合は、方式を説明する過去の例であることを示した。

本番試験は65問・90分で、50問が採点対象、15問が採点対象外。模試は65問すべてを学習用に採点する。公開されている採点対象の分野比率20・24・28・14・14%を65問に按分し、1回分を13・16・18・9・9問とした。分野別の独立候補は65・80・90・45・45問で、ビルド時の5倍検査を有効にした。単一選択、複数選択、並べ替え、組み合わせを収録している。

新規184通りの採点、累計234件の出典への直接到達、自動検査13件を確認した。65問・90分を512回、カスタム全65件数、出題判断が重複しない5回を128組組んで検証し、全326レコードが抽選対象になることも確認した。公開前レビューに基づき、公平性の再現率差に関する設問へ重複候補を差し替え、照会用と追加質問用のアクショングループ、蒸留ログの教師モデル一致、PDFのページ番号が取得できる条件を明示した。

- [AWS Certified AI Practitionerの試験条件](https://aws.amazon.com/certification/certified-ai-practitioner/)
- [AWS Certified AI Practitionerの試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html)
- [Amazon Bedrockモデルの提供状況](https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html)

## DVA-C03の独立65問とフル模試の構成

AWSのDVA-C03は65問・130分。採点対象50問の分野比率30・26・22・22%を全65問に按分し、AWSサービスでの開発20問、セキュリティ17問、テストとデプロイ14問、トラブルシューティングと最適化14問とした。公開に必要な独立候補は分野別に100・85・70・70問、合計325問。

旧DVA-C02の10問は設問・選択肢・正答・改訂番号を保持し、分野、類似グループ、個別の出典を追加した。SQSとKinesisの部分バッチ応答は異なる挙動を学べるが、どちらも同じ設定を正答とするため、模試では片方だけを選ぶ。新版の出題範囲に沿って56問を加え、計66レコード、独立65問になった。単一選択61問・複数選択5問を収録している。

開発では空のDynamoDBページから読み進める条件や、同期ワークフローのHTTP応答と実行結果の違いを確認した。セキュリティではBedrockをプライベートに呼ぶための接続設定と、モデル出力を表示前に検査する方法を扱った。テストとデプロイではECRのタグ上書きルール、AppConfigの配布前検証と配布後のロールバック、CloudFormationの置換前後を分けた。トラブルシューティングではLambdaの同時実行枠、DAXの整合性、RDS Proxyのセッション状態を扱った。

設問を読み込み、全1,136通りの選択肢の組み合わせを採点して確認した。模試生成処理でフル256回、カスタムの全65件数を実行し、分野配分、所要時間、各回の類似グループ重複排除、全66レコードが抽選に入ることを確認した。公開前に残り80・68・56・56問を追加し、実データで重複のないフル模試5回分、旧版の履歴・途中の模試の互換、資格別レビューを確認する。

- [AWS Certified Developer – Associate試験概要](https://aws.amazon.com/certification/certified-developer-associate/)
- [DVA-C03試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/developer-associate-03.html)
- [DVA-C02とDVA-C03の比較](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/dva-03-comparison.html)

## DVA-C03の独立130問と重複なしの模試2回分

AWSサービスでの開発20問、セキュリティ17問、テストとデプロイ14問、トラブルシューティングと最適化14問を追加した。第1弾の66レコードを保持し、独立候補は分野順に40・34・28・28問。累計131レコードのうち単一選択120問、複数選択11問を収録している。

開発ではイベント通知のキー復号、S3の部分読み取り、Bedrockのツール結果、Kinesisの専用読み取り枠を確認した。セキュリティではRDSのIAMトークンが新規接続の認証にだけ使われる点や、CodeArtifactの二次トークンの期限、HTTP APIを相互TLS付きのカスタムドメインに限定する設定を扱った。テストとデプロイでは、変更セットの実行ごとの識別、マトリックスビルド、ECRの期限切れプレビューを追加した。障害切り分けでは、処理中上限に達したSQSの長いポーリング、RDS Proxyの貸し出し待ち、CloudFrontの言語別キャッシュを扱った。

同じサービスが登場する候補は、判断に使う条件と正答を確認した。SQSの可視性の延長と上限到達の診断、API Gatewayの入力検証と入力マッピング、ECSのロールバック成立条件と失敗イベント通知にはそれぞれ異なる判断が必要になる。

出典127件への到達と、全2,272通りの回答の採点を確認した。フルの生成512回、カスタム全65件数、互いに重複しないフル2回分を128組生成した。各回は65問・130分、分野配分20・17・14・14問。公開に必要な各分野5回分まで、残り60・51・42・42問。

- [DVA-C03の対象サービス](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/dva-03-in-scope-services.html)
- [CodePipelineのCloudFormationアクション](https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CloudFormation.html)
- [SQSの可視性と処理中メッセージ上限](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)

## DVA-C03の独立195問と重複なしの模試3回分

開発20問、セキュリティ17問、テストとデプロイ14問、トラブルシューティングと最適化14問を追加した。既存131レコードを保持し、累計196レコードのうち独立195問、分野順に60・51・42・42問。単一選択182問、複数選択14問を収録している。

開発ではSQSでフィルター対象外のメッセージが削除される条件、S3通知の同一キー内の順序、ステップの実行結果を既存入力へ追加する設定を扱った。セキュリティではKMSグラントを発行直後から利用する場合、関数URLを別アカウントへ許可する場合、推論でガードレール指定を必須にする場合を追加した。テストとデプロイではECRの既存イメージをバックフィルする手順、極力稼働数を維持するECS更新、構成に対するCDKの共通検証を扱った。障害切り分けでは、SQS標準DLQの期限の起点、ECSのコンテナ別CPU指標、CloudFrontのメソッド別フェイルオーバーを確認した。

文章が近い設問について判定条件と正答を照合した。Secrets Managerの候補の昇格と、昇格後のアプリ側の再取得、DynamoDBのテナント認可と月次のキー条件、CloudFormationでの置換禁止と承認後の変更セット実行では、別の操作や条件を問う。

出典191件の到達、全3,360通りの採点、フル生成512回、カスタム全65件数を確認した。65問・130分で分野配分20・17・14・14問のフル模試を、互いに重複しない3回分として128組生成した。公開条件の各分野5回分まで、残り40・34・28・28問。

- [DVA-C03の対象サービス](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/dva-03-in-scope-services.html)
- [ECRレプリケーションバックフィル](https://docs.aws.amazon.com/AmazonECR/latest/userguide/replication-backfill.html)
- [Lambda関数URLの認可](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html)

## DVA-C03の独立260問と重複なしの模試4回分

開発20問、セキュリティ17問、テストとデプロイ14問、トラブルシューティングと最適化14問を追加した。既存196レコードを維持し、累計261レコードのうち独立260問。分野順に80・68・56・56問で、単一選択239問、複数選択22問を収録した。新規の選択肢順を調整し、単一選択の正答位置はAから順に60・59・60・60問になった。

開発ではAurora Data APIのトランザクション、Lambdaのストリーミング応答、BedrockのJSON構造化出力を扱った。セキュリティではGitHub OIDCで配備するブランチの限定、JWT署名鍵の移行、Cognitoの認証失敗の統一を確認した。テストとデプロイではLambdaの環境変数の競合防止、CDKの合成結果の再現、CodePipelineの本番進入条件を問う。障害切り分けではCloudFrontで応答送信中の切断を見分ける方法、DynamoDBの書き込み制限の観測単位、Database Insightsの待機とSQLを扱った。

文章と正答の決め手を既存候補と照合し、イベントの途中で識別子を保持する候補と、資格情報の交互ローテーションの候補を差し替えた。Kinesisのチェックポイント直後から再開する判断と、Cognitoで利用者の存在を示さず認証失敗を返す判断を追加した。

出典249件の到達と全4,528通りの採点を確認した。フル生成512回、カスタム全65件数に加え、65問・130分で分野配分20・17・14・14問を満たす互いに重複しない模試4回分を128組生成した。公開条件の各分野5回分まで、残り20・17・14・14問。

- [DVA-C03の対象サービス](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/dva-03-in-scope-services.html)
- [Aurora Data APIの操作](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.calling.cli.html)
- [Cognitoのユーザー存在エラー制御](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html)

## DVA-C03の独立325問と重複なしの模試5回分

開発20問、セキュリティ17問、テストとデプロイ14問、トラブルシューティングと最適化14問を追加した。既存261レコードを保持し、累計326レコードのうち独立325問。各分野に100・85・70・70問を揃えた。単一選択297問、複数選択29問で、単一選択の正答位置はAから順に74・74・74・75問。

新規設問では、一括発行結果の個別処理、GraphQLのバッチ結果の対応順、S3バケットキーを有効にした際の暗号化コンテキスト、配備時の初期化シグナル、検索シャードのスローログなどを扱う。一次資料へ照合し、既存のDAXの設問と同じ強い整合性を問う草稿はAppSyncのバッチリゾルバーへ差し替えた。SQSのグループIDで並び順を決める問題と、重複排除IDで同じ本文の別操作を区別する問題は、それぞれ別の設計判断を問う。

出典308件の取得、全5,680通りの採点、フル模試の生成512回、カスタム全65件数を確認した。65問・130分、分野配分20・17・14・14問を満たす、相互に重複のない模試5回分を128組生成した。AWSの4分野の配分は採点対象50問に適用される。教材では練習結果を解説に反映するため全65問を採点する。

DVA-C02の公開ページで保存した未提出の模試と提出済み履歴を新版のビルドで開き、保存時の選択肢・制限時間を保って提出できることを確認した。新版のフル模試は日本語で開始し、英語ページで再開した。単一・複数選択を採点し、結果の分野別の合計が出題時の4分野と一致することを確認した。旧版で登録した取得済み資格は新版の査定に引き継ぐ。旧版の学習・資格詳細へのリンクは、同じ言語の新版へ転送する。

- [DVA-C03公式試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/developer-associate-03/developer-associate-03.html)
- [AppSyncのLambdaバッチリゾルバー](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-reference-lambda-js.html)
- [S3バケットキーと暗号化コンテキスト](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-key.html)

## SOA-C03のフル模試1回分

新規55問と既存10問を、監視・分析・修復と性能最適化14問、信頼性と事業継続14問、デプロイ・プロビジョニングと自動化14問、セキュリティとコンプライアンス11問、ネットワークとコンテンツ配信12問の独立65問にまとめた。AWS公式試験の配分22・22・22・16・18％は採点対象50問に適用される。教材では合計65問・130分の練習用配分に換算し、全65問の結果を確認できる形とした。

既存10問の設問ID、改訂番号、本文、選択肢、正答を維持し、出題分野と類似グループを付けた。既存設問の参照先は、それぞれのAWS仕様を説明する資料に更新した。EventBridgeのルール選択を繰り返す草稿は、状態収集後に承認者が判断するSystems Manager Automationの設問へ差し替えた。ALBのヘルスチェックを軽くする設問と、Route 53の主副リージョン切替を設定する設問は、制御点と運用判断が異なる。

単一選択59問、複数選択6問。フル模試の生成512回、カスタム全65件数、全1,136通りの採点を検証した。分野ごとの5倍に達するには、順に56・56・56・44・48問を追加する。

- [SOA-C03公式試験の概要](https://aws.amazon.com/certification/certified-cloudops-engineer-associate/)
- [SOA-C03の公式試験ガイド](https://docs.aws.amazon.com/pdfs/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03.pdf)

## SOA-C03の重複しないフル模試2回分

新規65問を追加し、既存65問を維持した。監視・分析・修復と性能最適化28問、信頼性と事業継続28問、デプロイ・プロビジョニングと自動化28問、セキュリティとコンプライアンス22問、ネットワークとコンテンツ配信24問で、独立130問となった。単一選択117問、複数選択13問。単一選択の正答位置はAから順に29・29・29・30問。

設問と正答文の近い組を運用上の判断まで比較した。S3の複製設定を再び選ばせる草稿をEFSの項目レベル復元へ変更し、IPv4のNAT経路に似た草稿を組織内のCIDR重複を探すIPAMの問題へ変更した。DNSはVPCから社内DNSへの転送と、重複するプライベートゾーンでの優先順位を扱う。Systems Managerで承認を設定する既存問題があるため、新規の自動化では利用中のCloudFormationエクスポートを段階的に移行する判断を扱った。

出典128件、全2,288通りの採点、フル模試の生成512回、カスタム全65件数を確認した。65問・130分、分野配分14・14・14・11・12のフル模試を、互いに問題が重複しない2回分として128組生成した。分野ごとの5倍に達するには、順に42・42・42・33・36問を追加する。

- [EFSの項目レベル復元](https://docs.aws.amazon.com/aws-backup/latest/devguide/restoring-efs.html)
- [VPC IPAMのCIDR使用状況と重複](https://docs.aws.amazon.com/vpc/latest/ipam/monitor-cidr-compliance-ipam.html)

## SOA-C03の重複しないフル模試3回分

新規65問を追加し、既存130問を維持した。独立195問の分野別内訳は順に42・42・42・33・36問。単一選択174問、複数選択21問で、単一選択の正答位置はAから順に44・44・43・43問。

正答の決め手が近い草稿を照合した。タグによるバックアップ選択の繰り返しはEBS Multi-Attachの条件へ、既出のゾーンシフトに近い草稿はS3の削除マーカーからの復旧へ差し替えた。複製速度の設定が既出のため、新たにDataSyncでは差分の転送後に既存コピーを含めて検証する判断を扱った。AWS DevOps Agentの調査レビューでは、対応を承認する前に結論の根拠を評価する手順を問う。

出典192件、全3,456通りの採点、フル模試の生成512回、カスタム全65件数を確認した。65問・130分、配分14・14・14・11・12問のフル模試を、互いに問題が重複しない3回分として128組生成した。分野ごとの5倍まで、順に28・28・28・22・24問を追加する。

- [AWS DataSyncの検証設定](https://docs.aws.amazon.com/datasync/latest/userguide/configure-data-verification-options.html)
- [AWS DevOps Agentの調査レビュー](https://docs.aws.amazon.com/devopsagent/latest/userguide/working-with-devops-agent-reviewing-investigations.html)

## SOA-C03の重複しないフル模試4回分

新規65問を追加し、既存195問を維持した。独立260問の分野別内訳は順に56・56・56・44・48問。単一選択231問、複数選択29問で、単一選択の正答位置はAから順に58・58・58・57問。

既存設問と草稿の正答の決め手を照合した。同じスケーリング設定を選ばせる草稿は、ECS Execの有効化状態とEKSのKubernetes監査ログを確認する問題に差し替えた。KMSではEBS経由の要求に絞るポリシー条件と、CloudWatch Logsのロググループを暗号化コンテキストで絞る条件を扱う。災害対策ではS3の複製状況を前提として、Multi-Region Access Pointの二つのリージョンでルーティング状態を切り替える手順を問う。

新規65問の出典を含む254件のURL、全4,624通りの採点、フル模試の生成512回、カスタム全65件数を確認した。65問・130分、分野配分14・14・14・11・12問のフル模試を、互いに問題が重複しない4回分として128組生成した。分野ごとの5倍まで残り65問。

- [SOA-C03の監視・分析・修復と性能最適化](https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain1.html)
- [S3 Multi-Region Access Pointのフェイルオーバー制御](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingFailover.html)
- [CloudWatch LogsのロググループとKMS暗号化コンテキスト](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)

## SOA-C03の独立325問と重複なしの模試5回分

65問を追加し、独立325問を学習・模擬試験の出題元に登録した。分野ごとの母数は70・70・70・55・60問。フル模試は65問・130分で、各回の分野配分を14・14・14・11・12問とした。単一選択289問、複数選択36問で、単一選択の正答位置はAから順に73・72・72・72問。

既出のVPC Reachability Analyzerによる静的経路診断を繰り返す草稿は、AWS Site-to-Site VPNのIKEログで障害を調査する問題に差し替えた。KMSの復号権限に近い草稿は、AWS Secrets Managerの交互ユーザー方式に変更した。CloudFrontのキャッシュ制御やRoute 53のルーティングとは別に、AWS Shield Advancedがサービスのヘルス状態を踏まえてプロアクティブに連絡するための設定を扱う。

出典317件、全5,776通りの採点、フル模試の生成512回、カスタム全65件数、互いに重複しないフル模試5回分の生成128組を確認した。既存の公開10問はID・改訂番号・本文・選択肢・正答を維持し、さらに旧6問を履歴から参照できる。

- [SOA-C03の試験概要](https://aws.amazon.com/certification/certified-cloudops-engineer-associate/)
- [Site-to-Site VPNのトンネルログ](https://docs.aws.amazon.com/vpn/latest/s2svpn/monitoring-logs.html)
- [Secrets Managerのローテーション方式](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotation-strategy.html)
- [Shield Advancedのプロアクティブエンゲージメント](https://docs.aws.amazon.com/waf/latest/developerguide/ddos-srt-proactive-engagement.html)

## DEA-C01のフル模試1回分

新規56問と既存10問をレビューした。既存のIcebergのMERGEを選ぶ問題と、順不同の更新でMERGEを使う問題は同じ類似グループとした。どちらも出題候補として保持し、同じ回には片方だけを出す。既存10問は設問ID、改訂番号、本文、選択肢、正答を維持し、設問に対応する出典と分野を付けた。

全66レコードのうち、独立した出題枠は65問。AWS公式の配分34・26・22・18％は採点対象に対する割合で、練習用には65問・130分に合わせて分野ごとに22・17・14・12問とした。単一選択59問、複数選択7問。フル模試の生成512回で毎回の配分と類似グループの排他を検証し、カスタム全65件数、全1,168通りの採点、出典65件も確認した。

分野ごとの5倍に達するには、順に88・68・56・48問を追加する。

- [DEA-C01の試験概要](https://aws.amazon.com/certification/certified-data-engineer-associate/)
- [DEA-C01の公式試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.html)
- [AthenaのIcebergテーブルへのMERGE](https://docs.aws.amazon.com/athena/latest/ug/merge-into-statement.html)

## DEA-C01の重複しないフル模試2回分

新規65問を追加し、既存66レコードを維持した。類似グループで数えた独立130問の分野別内訳は44・34・28・24問。単一選択117問、複数選択14問で、単一選択の正答位置はAから順に30・29・29・29問。

取り込みでは、Firehoseが意図的な破棄を認識する応答と、配信時にParquetへ変換する設定を別の判断として扱った。監視ではDMSの取得と適用の遅延を分け、Redshiftでは結果の処理がディスクへ退避した実行ステップを特定する。TLSの完全検証を別サービスで再び選ばせる草稿は、DataBrewで原本を保ちながら派生データから直接識別子を除く問題へ差し替えた。

65問・130分、分野配分22・17・14・12問のフル模試を、互いに設問が重複しない2回分として128組生成した。フル模試の生成512回、カスタム全65件数、採点2,320通り、出典128件を確認した。分野ごとの5倍まで残り66・51・42・36問。

- [Firehoseの変換結果コード](https://docs.aws.amazon.com/firehose/latest/dev/data-transformation-status-model.html)
- [DMSのレプリケーション監視](https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Monitoring.html)
- [Redshiftのステップ別クエリ情報](https://docs.aws.amazon.com/redshift/latest/dg/SYS_QUERY_DETAIL.html)
- [DataBrewでの個人識別情報の取り扱い](https://docs.aws.amazon.com/databrew/latest/dg/personal-information-protection.html)

## DEA-C01の重複しないフル模試3回分

新規65問を追加し、既存131レコードを維持した。類似グループで数えた独立195問の分野別内訳は66・51・42・36問。単一選択174問、複数選択22問で、単一選択の正答位置はAから順に44・44・43・43問。

複数のAirflow DAGで共有するAPIの同時接続制限、Redshift Data APIでの完了確認とページ取得、Glueのパーティションメタデータを取得前に絞る条件を追加した。既出のRedshiftクライアントとのTLS接続に近い草稿は、OpenSearchノード間の通信を保護する設定へ差し替えた。Lake FormationではテーブルのSELECT付与と、Athenaがデータアクセス用の資格情報を得るためのIAM許可を別の判断として扱った。

65問・130分、分野配分22・17・14・12問のフル模試を、互いに設問が重複しない3回分として128組生成した。フル模試の生成512回、カスタム全65件数、採点3,488通り、出典185件を確認した。分野ごとの5倍まで残り44・34・28・24問。

- [Airflowのプール](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/pools.html)
- [Redshift Data API](https://docs.aws.amazon.com/redshift/latest/mgmt/data-api.html)
- [Glueでのパーティション条件](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-pushdown.html)
- [OpenSearchのノード間暗号化](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/ntn.html)

## DEA-C01の重複しないフル模試4回分

新規65問を追加し、既存196レコードを維持した。類似グループで数えた独立260問の分野別内訳は88・68・56・48問。単一選択229問、複数選択32問で、単一選択の正答位置はAから順に58・57・57・57問。

DocumentDBの複合索引、Neptuneの多段探索、CQL互換のKeyspaces、MemoryDBの永続ストア、Aurora PostgreSQLのHNSWを追加した。運用では、DynamoDBのGSI作成進捗と主表へのスロットリングの影響を別のメトリクスで評価する。再試行を選ばせる草稿の一つは、EventBridge Pipesの処理段階を記録し、実行データはログに含めない設定に差し替えた。

65問・130分、分野配分22・17・14・12問のフル模試を、互いに設問が重複しない4回分として128組生成した。フル模試の生成512回、カスタム全65件数、採点4,688通り、出典249件を確認した。分野ごとの5倍まで残り22・17・14・12問。

- [Amazon DocumentDBの複合索引](https://docs.aws.amazon.com/documentdb/latest/devguide/indexes-compound.html)
- [pgvectorのHNSW](https://github.com/pgvector/pgvector#hnsw)
- [DynamoDBのオンラインGSI管理](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.OnlineOps.html)
- [EventBridge Pipesのロギング](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-logs.html)

## DEA-C01の重複しないフル模試5回分

新規65問を追加し、既存261レコードを維持した。独立325問の分野別内訳は、データの取り込みと変換110問、データストア管理85問、データ運用とサポート70問、データセキュリティとガバナンス60問。単一選択288問の正答位置はA〜D各72問で、複数選択は38問。

同一キーの明細を維持するSparkの左アンチ結合、SageMaker Unified StudioへのOpenLineageイベント登録、Glue Data Qualityでの合否判定を伴わない統計収集、AWS KMSでのリージョン内復号を追加した。CloudTrail Lakeを扱う設問では、対象の組織が既存利用者でイベントを取り込み済みと明記した。Iceberg MERGEの既存2問は同じ類似グループに属し、保存済み模試から参照できるよう両方の設問IDを保持した。

65問・130分のフル模試を分野別に22・17・14・12問で構成する。フル模試512回、互いに重複しないフル模試5回分を128組、カスタム全65件数、採点5,824通り、出典URL311件を検証した。

- [AWS認定 データエンジニア アソシエイト試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.html)
- [Spark SQLの結合](https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-join.html)
- [SageMaker Unified Studioのデータリネージ](https://docs.aws.amazon.com/sagemaker-unified-studio/latest/userguide/datazone-data-lineage.html)
- [Glue Data Qualityのアナライザー](https://docs.aws.amazon.com/glue/latest/dg/dqdl.html#dqdl-analyzers)
- [AWS KMSのマルチリージョンキー](https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html)

## DOP-C02のフル模試1回分

既存10レコードの設問ID・リビジョン・採点内容を維持し、新規66問を追加した。既存の成果物ダイジェストと承認に関する2問は同じ類似グループとし、同一模試への同時出題を防ぐ。合計76レコードで独立75問。単一選択69問の正答位置はA〜Dの順に18・17・17・17問で、複数選択は7問。

AWS公開の採点対象の比重を比例配分し、65問の採点対象と10問の採点対象外を含む本試験と同じ75問・180分の練習用構成にした。6分野の配分は17・13・11・11・10・13問。最終的に各分野を85・65・55・55・50・65問へ拡充する。

デプロイ前後のゲート、スタック置換時の保持設定、Aurora Global Databaseの計画切替、アラームの評価条件、FIFO入力の部分失敗、短期資格情報によるCIの認証などを扱う。正答の長さが手がかりになりやすい選択肢28問を調整した。フル模試512回の出題、カスタム全75件数、採点1,328通り、出典URL74件を確認した。

- [AWS認定 DevOps Engineer – Professional 試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html)
- [CodePipelineのステージ条件](https://docs.aws.amazon.com/codepipeline/latest/userguide/stage-conditions.html)
- [Aurora Global Databaseのスイッチオーバーとフェイルオーバー](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-disaster-recovery.html)
- [LambdaでのSQS部分バッチ応答](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html)

## DOP-C02の重複しないフル模試2回分

新規75問を追加し、既存76レコードを維持した。類似グループで数えた独立150問の分野別内訳は34・26・22・22・20・26問。単一選択135問の正答位置はA〜Dの順に34・34・34・33問で、複数選択は16問。

失敗アクションだけの再試行、展開済みCloudFormationテンプレートの再評価、S3の特定バージョン削除と複製、EKS更新時の中断予算、ログの等値検索と走査量、通知が順不同に届く場合の索引更新、CloudTrailのログ整合性検証を追加した。既存の成果物承認に関する2問は両IDを維持し、同一模試内では片方まで出題する。

75問・180分の模試を512回生成し、分野配分17・13・11・11・10・13問を確認した。互いに設問が重複しないフル模試2回分を128組生成したほか、カスタム全75件数、採点2,672通り、出典URL144件を検証した。

- [CodePipelineの失敗したアクションの再試行](https://docs.aws.amazon.com/codepipeline/latest/userguide/stage-retry.html)
- [CloudFormationのAWS::LanguageExtensions](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/transform-aws-languageextensions.html)
- [S3のレプリケーション対象](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-what-is-isnot-replicated.html)
- [S3イベントのsequencer](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html)

## DOP-C02の重複しないフル模試3回分

新規75問を追加し、既存151レコードを維持した。独立225問の分野別内訳は51・39・33・33・30・39問。単一選択200問の正答位置はA〜D各50問で、複数選択は26問。

実行中の変更を待つパイプライン停止、物理資源を維持するスタックの分割、同期レプリケーションでの復旧時点の設計、版単位のLambda指標、修復失敗後の補償処理、CloudFrontから非公開オリジンへのアクセスなどを追加した。近い題材の候補は、必要な判断と制約を比較して調整した。

75問・180分の模試を512回生成し、分野別配分17・13・11・11・10・13問を確認した。互いに重複しないフル模試3回分を128組生成し、カスタム全75件数、採点4,032通り、出典URL215件を検証した。

- [CloudFormationのスタックリファクタリング](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-refactoring.html)
- [DynamoDBグローバルテーブルの整合性モード](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html)
- [Systems Manager Automationの失敗時の制御](https://docs.aws.amazon.com/systems-manager/latest/userguide/automation-actions.html)
- [CloudFrontからS3オリジンへのアクセス制限](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

## DOP-C02の重複しないフル模試4回分

新規75問を追加し、既存226レコードを維持した。類似グループで数えた独立300問の分野別内訳は68・52・44・44・40・52問。単一選択265問の正答位置はA〜Dの順に67・66・66・66問で、複数選択は36問。

Elastic Beanstalkの配布方式、CloudFormationの別リージョン出力参照、Kinesisのコンシューマー単位の読取り容量、CloudWatch Logsの定期照会、DynamoDBのTTL削除を識別できるリージョン、Organizationsのリソース制御ポリシーなどを追加した。同じサービスを扱う既存問とは、選択に使う制約と操作結果を比較した。

75問・180分の模試を512回生成し、配分17・13・11・11・10・13問を確認した。互いに設問が重複しない4回分を128組生成し、カスタム全75件数、採点5,392通り、出典URL285件を検証した。

- [CloudFormationのFn::GetStackOutput](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getstackoutput.html)
- [Kinesisの拡張ファンアウト](https://docs.aws.amazon.com/streams/latest/dev/enhanced-consumers.html)
- [DynamoDB StreamsでのTTL削除の識別](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ttl-expired-items.html)
- [Organizationsのリソース制御ポリシー](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html)

## DOP-C02の重複しないフル模試5回分

6分野に新規75問を追加し、既存301レコードを維持した。類似グループで数えた独立375問の分野別内訳は85・65・55・55・50・65問。単一選択333問の正答位置はA〜Dの順に84・83・83・83問で、複数選択は43問。新規の単一選択68問は正答の位置に加え、選択肢の長さだけで正答を推測しにくいよう文量も調整した。

CloudFormationの成果物から実行時パラメータを取得する問題、閉域内での待機条件の応答、Global Acceleratorでの既存接続の維持、EBSの帯域制限の切り分け、AWS Healthの経路冗長化、バックアップの複数者承認などを扱う。既存問と同じ判断を問うCodePipelineの並列実行、ALBの登録解除、CloudWatchの学習期間除外は草稿から差し替えた。近似候補も選択肢の根拠まで比較し、例えばStep Functionsから次のアクションへ渡す出力ファイル、CodeBuildのエクスポート変数、CloudFormationの成果物内の値はそれぞれ異なる制約と操作を問うようにした。

75問・180分の模試を512回生成し、分野配分17・13・11・11・10・13問を確認した。互いに設問が重複しないフル模試5回分を128組生成し、カスタム全75件数、採点6,704通り、出典URL357件を検証した。従来の10レコードと過去版6レコードの配信データを維持する。本試験では採点対象外の問題が含まれるが、このアプリは全75問を採点する。

- [DOP-C02試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html)
- [CloudFormationのパラメータ上書き関数](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/continuous-delivery-codepipeline-parameter-override-functions.html)
- [Global Acceleratorのトラフィックダイヤル](https://docs.aws.amazon.com/global-accelerator/latest/dg/about-endpoint-groups-traffic-dial.html)
- [AWS Healthのリージョン別配信と重複排除](https://docs.aws.amazon.com/health/latest/ug/choosing-a-region.html)
- [AWS Backupボールトの複数者承認](https://docs.aws.amazon.com/aws-backup/latest/devguide/multipartyapproval.html)

## SCS-C03のフル模試1回分

AWSの試験ガイドの分野比率16・14・18・20・18・14%に合わせ、65問・170分のフル模試を10・9・12・13・12・9問に配分する。新規56問を作成し、従来の9題は事例の条件と誤答の根拠を見直して改訂した。単一選択56問、複数選択7問、並べ替え1問、組み合わせ1問を収録する。

既存の2問が同じ判断を求めていたS3経由のKMS復号は、改訂した1問を新バンクで出題する。従来の10レコードと過去版6レコードは元の配信ファイルで維持し、保存済み模試を旧ID・改訂番号で解決できるようにする。新バンクでは、同じS3やSecurity Hub CSPMを扱う組も、事故復旧、暗号化されたデータの認可、リージョン間の集約、コントロールの評価前提などの判断を分けた。

フル模試の生成512回で各分野の配分と類似グループの重複がないことを確認した。カスタム全65件数と、単一・複数選択の組み合わせおよび並べ替え・組み合わせの順列を合わせた採点1,150通りを検証した。出典URL64件と旧版16レコードの回復時のキーも確認した。

- [SCS-C03試験ガイド](https://docs.aws.amazon.com/aws-certification/latest/security-specialty-03/security-specialty-03.html)
- [CloudTrailの詳細イベントセレクタ](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/filtering-data-events.html)
- [AWSのフォレンジック用アカウント](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture-cyber-forensics/forensics-account.html)
- [IAMロールの一時認証情報の取り消し](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html)
