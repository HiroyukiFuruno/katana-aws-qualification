import type { Locale } from './locales';

type CertificationGuide = {
  scope: string;
  difficulty: number;
  why: string;
  audience: string;
  path: string;
};

export const certificationGuides: Record<string, CertificationGuide> = {
  'clf-c02': {
    scope:
      'AWSクラウドの価値、責任共有モデル、主要サービスの役割、料金とサポートを理解しているかを確認します。',
    difficulty: 1,
    why: '基本用語とサービスの使い分けが中心です。',
    audience: 'AWSを初めて学ぶ方や、営業・企画などで開発チームとクラウドの前提をそろえたい方。',
    path: 'cloud-practitioner-02',
  },
  'aif-c01': {
    scope: 'AI・機械学習・生成AIの基本、基盤モデルの用途、責任あるAIとデータガバナンスを扱います。',
    difficulty: 2,
    why: 'モデルを実装するより、用途やリスクを説明できることが重要です。',
    audience: 'AIを使った企画や業務改善に関わる方、AI開発を学び始めた方。',
    path: 'ai-practitioner-01',
  },
  'saa-c03': {
    scope: '安全で可用性が高く、性能とコストの要件を満たすAWSアーキテクチャの設計を扱います。',
    difficulty: 3,
    why: '似た構成の中から、可用性・接続経路・運用負荷などの制約を満たす案を選びます。',
    audience: 'AWSの設計を体系的に学びたいインフラエンジニア、SRE、アプリ開発者。',
    path: 'solutions-architect-associate-03',
  },
  'dva-c02': {
    scope: 'AWS上のアプリケーション開発、認証と権限、デプロイ、障害調査を扱います。',
    difficulty: 3,
    why: 'Lambdaの再試行やDynamoDBの条件付き更新など、実装時の挙動まで問われます。',
    audience: 'AWSのマネージドサービスでバックエンドやサーバーレスアプリを作る開発者。',
    path: 'developer-associate-02',
  },
  'soa-c03': {
    scope: 'AWS環境の監視、信頼性、障害対応、ネットワーク、運用自動化を扱います。',
    difficulty: 3,
    why: '症状から原因を切り分け、運用の制約に合う復旧・改善方法を選びます。',
    audience: 'クラウド運用担当者や、監視と障害対応を体系化したいSRE。',
    path: 'sysops-administrator-associate-03',
  },
  'dea-c01': {
    scope: 'データの取り込み、変換、保存、パイプライン運用、アクセス管理を扱います。',
    difficulty: 3,
    why: '処理方式ごとに、遅延、再実行、コスト、アクセス制御の違いを理解する必要があります。',
    audience: 'ETLやデータレイク、分析基盤の構築・運用に関わる方。',
    path: 'data-engineer-associate-01',
  },
  'mla-c01': {
    scope: '学習データの準備、モデル開発、デプロイ、モデルと基盤の監視を扱います。',
    difficulty: 4,
    why: '機械学習の評価指標と、AWS上での配備・運用の両方が問われます。',
    audience: '学習済みモデルを本番に載せ、品質やコストを継続管理したいMLエンジニア。',
    path: 'machine-learning-engineer-associate-01',
  },
  'sap-c03': {
    scope:
      '組織横断のクラウド設計、セキュリティとガバナンス、コスト、移行・事業継続、運用自動化を扱います。AI/MLを組み込む設計も範囲に含まれます。',
    difficulty: 5,
    why: '複数アカウントや既存システムの制約が重なる場面で、運用・コスト・復旧要件を同時に評価します。',
    audience: '複数チームの設計をレビューするアーキテクト、クラウド移行や標準化を担うテックリード。',
    path: 'solutions-architect-professional-03',
  },
  'dop-c02': {
    scope: 'CI/CD、構成管理、監視、インシデント対応、セキュリティと可用性の自動化を扱います。',
    difficulty: 5,
    why: '複数環境への展開や異常検知後のロールバックまで、一連の運用を設計する力が必要です。',
    audience: '複数チームのリリース基盤やクラウド運用の自動化を担うDevOpsエンジニア、SRE。',
    path: 'devops-engineer-professional-02',
  },
  'aip-c01': {
    scope: '基盤モデルを使った生成AIアプリの設計、RAG、エージェント、評価、安全性、本番運用を扱います。',
    difficulty: 5,
    why: '検索と生成の品質、アクセス制御、レイテンシー、推論コストを同時に検討します。',
    audience: '生成AI機能を検証から本番運用まで持っていく開発者やアーキテクト。',
    path: 'ai-professional-01',
  },
  'scs-c03': {
    scope: 'IDとアクセス管理、暗号化、インフラ保護、脅威検知、調査とインシデント対応を扱います。',
    difficulty: 5,
    why: '複数アカウントのIAM・リソース・鍵のポリシーを合わせて読み、実際の許可や拒否を判断します。',
    audience: 'クラウドのセキュリティ設計、監査、脆弱性対応を担当する方。',
    path: 'security-specialty-03',
  },
  'ans-c01': {
    scope:
      'AWSとオンプレミスの接続、ネットワーク設計、経路制御、運用とトラブルシューティングを扱います。',
    difficulty: 5,
    why: 'BGP経路、DNSの転送方向、複数VPC間の到達性を前提条件から追う必要があります。',
    audience: 'Direct ConnectやTransit Gatewayを使うハイブリッド基盤を設計・運用する方。',
    path: 'advanced-networking-specialty-01',
  },
  'ai-business-strategist': {
    scope: 'AI投資の優先順位、事業価値の測定、リスク管理、組織への導入と定着を扱います。',
    difficulty: 3,
    why: 'AIの基本に加え、事業成果、導入準備、ガバナンスをケースごとに比較する力が必要です。',
    audience: 'AI導入の意思決定を担う事業責任者、プロダクト責任者、コンサルタント。',
    path: 'ai-business-strategist-01',
  },
};

// AWS sometimes serves English content under a localized URL. These editions
// were checked against the language of the guide itself.
const guideLocales: Readonly<Record<string, readonly Locale[]>> = {
  'cloud-practitioner-02': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'],
  'ai-practitioner-01': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'],
  'solutions-architect-associate-03': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'es', 'it'],
  'developer-associate-02': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'data-engineer-associate-01': ['ja', 'zh-CN', 'ko'],
  'machine-learning-engineer-associate-01': ['ja', 'zh-CN', 'ko'],
  'solutions-architect-professional-03': ['zh-CN'],
  'devops-engineer-professional-02': ['ja', 'zh-CN', 'ko'],
  'ai-professional-01': ['ja', 'zh-CN', 'ko'],
  'security-specialty-03': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'advanced-networking-specialty-01': ['ja', 'zh-CN', 'ko'],
  'ai-business-strategist-01': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'sysops-administrator-associate-03': ['ja', 'zh-CN', 'ko'],
};

const awsDocsLocales: Partial<Record<Locale, string>> = {
  ja: 'ja_jp',
  'zh-CN': 'zh_cn',
  'zh-TW': 'zh_tw',
  ko: 'ko_kr',
  pt: 'pt_br',
  fr: 'fr_fr',
  de: 'de_de',
  es: 'es_es',
  it: 'it_it',
};

export function officialGuideLink(path: string, locale: Locale) {
  const language = guideLocales[path]?.includes(locale) ? locale : 'en';
  const prefix = awsDocsLocales[language];
  return {
    language,
    href: `https://docs.aws.amazon.com/${prefix ? `${prefix}/` : ''}aws-certification/latest/${path}/${path}.html`,
  };
}
