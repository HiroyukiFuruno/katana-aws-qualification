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
