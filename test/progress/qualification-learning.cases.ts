type QualificationLearningCase = {
  courseId: string;
  firstTitle: string;
  nextUnit: string;
  prompt: RegExp;
  answer: RegExp;
  choiceCount: number;
  figureInNextUnit?: boolean;
  additionalFigure?: { unit: string; asset: string };
};

export const qualificationLearningCases: QualificationLearningCase[] = [
  {
    courseId: 'clf-c02',
    firstTitle: 'クラウドの価値、責任共有、可用性',
    nextUnit: 'security-and-compliance',
    prompt: /小売会社の運用担当者は/,
    answer: /ゲストオペレーティングシステムに必要な更新/,
    choiceCount: 4,
  },
  {
    courseId: 'aif-c01',
    firstTitle: 'AI と機械学習の基礎',
    nextUnit: 'generative-ai-fundamentals',
    prompt: /小売会社の分析担当者は/,
    answer: /教師あり学習/,
    choiceCount: 3,
  },
  {
    courseId: 'ans-c01',
    firstTitle: 'グローバルな入口、DNS、負荷分散を設計する',
    nextUnit: 'hybrid-and-multivpc',
    prompt: /障害リージョンから別リージョンへ/,
    answer: /DNSフェイルオーバーは新しい名前解決で返す宛先を変える/,
    choiceCount: 4,
  },
  {
    courseId: 'saa-c03',
    firstTitle: 'セキュアなアーキテクチャを設計する',
    nextUnit: 'resilient-architecture',
    prompt: /請求書APIは/,
    answer: /配下のオブジェクトだけを対象に/,
    choiceCount: 3,
  },
  {
    courseId: 'dva-c03',
    firstTitle: 'AWS のサービスによる開発',
    nextUnit: 'security',
    prompt: /通販会社の開発者は/,
    answer: /SQS キューへ送り/,
    choiceCount: 4,
  },
  {
    courseId: 'soa-c03',
    firstTitle: '観測から修復までを一続きに運用する',
    nextUnit: 'reliability-and-continuity',
    prompt: /注文 API の当番担当者は/,
    answer: /同じ時間帯・同じ操作について/,
    choiceCount: 3,
  },
  {
    courseId: 'scs-c03',
    firstTitle: '検出を設計する',
    nextUnit: 'incident-response',
    prompt: /GuardDutyのS3保護を有効にしています/,
    answer: /データイベントを選択して記録し/,
    choiceCount: 3,
  },
  {
    courseId: 'dea-c01',
    firstTitle: 'データの取り込みと変換',
    nextUnit: 'data-store-management',
    prompt: /設備の状態が変わるたびに届くイベント/,
    answer: /イベントをストリームで取り込み、元のイベントを14日間保持する/,
    choiceCount: 4,
  },
  {
    courseId: 'sap-c03',
    firstTitle: 'クラウド向けアーキテクチャを設計・実装する',
    nextUnit: 'security-governance',
    prompt: /決済サービスのアーキテクトは、単一 AZ 障害では継続し、リージョン障害では/,
    answer: /操作ごとの RTO、RPO、依存関係、障害範囲を確認し、AZ とリージョンの障害に対/,
    choiceCount: 3,
  },
  {
    courseId: 'mla-c01',
    firstTitle: '機械学習のためのデータ準備',
    nextUnit: 'ml-model-development',
    prompt: /通販会社のMLエンジニアは、注文受付時点で返品の可能性を予測します/,
    answer: /注文受付時点で確定している商品、注文時刻、配送先地域を特徴量に使う。/,
    choiceCount: 4,
    additionalFigure: {
      unit: 'ml-workflow-deployment-and-orchestration',
      asset: 'mla-inference-decision-timing',
    },
  },
  {
    courseId: 'mla-c02',
    firstTitle: 'ML と AI のためのデータを準備する',
    nextUnit: 'model-and-fm-development',
    prompt: /需要予測モデルの担当者は、取り込み元または変換コードの版が変わった後も/,
    answer: /取り込み元、データ版、変換コード、学習・評価データ、モデルアーティファクトを関連付け/,
    choiceCount: 3,
  },
  {
    courseId: 'aip-c01',
    firstTitle: '基盤モデルの統合、データ管理、コンプライアンス',
    nextUnit: 'implementation-and-integration',
    prompt: /製薬会社のGenAI開発者は、社内の承認済み手順書だけを根拠に、現場担当者の/,
    answer: /承認状態と更新を管理した文書を検索し、取得片を応答へ渡して出典を示す。/,
    choiceCount: 4,
  },
  {
    courseId: 'dop-c02',
    firstTitle: 'SDLC を自動化する',
    nextUnit: 'configuration-and-iac',
    prompt: /決済 API のリリース担当者は、本番で実行されたコードが承認済みテストを通/,
    answer: /コミット、テスト結果、署名済みの不変アーティファクト、承認、環境昇格を一つの配信記録/,
    choiceCount: 3,
  },
  {
    courseId: 'ai-business-strategist',
    firstTitle: 'AIの基礎とリテラシー',
    nextUnit: 'strategy-value',
    prompt: /営業部長は固定の価格表に従う見積作成を自動化します。最初に選ぶ方式はどれです/,
    answer: /規則ベースの自動化/,
    choiceCount: 4,
    figureInNextUnit: true,
  },
];
