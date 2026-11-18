export const skills = {
  fundamentals: 'AWS基礎・コスト',
  architecture: 'アーキテクチャ',
  security: 'セキュリティ',
  networking: 'ネットワーク',
  development: 'アプリケーション開発',
  operations: '運用・DevOps',
  data: 'データエンジニアリング',
  ai: 'AI・機械学習',
} as const;

export type Skill = keyof typeof skills;
export type ExamBlueprint = { minutes: number; distribution: Record<string, number> };
export type Course = {
  practice: { path: string; label: string }[];
  mock: string;
  archives: string[];
  exam: ExamBlueprint;
  setSize?: number;
};

type Certification = {
  id: string;
  name: string;
  level: '基礎' | 'アソシエイト' | 'プロフェッショナル' | '専門' | 'ビジネス';
  skills: Skill[];
  focus: string;
  buildsOn?: string[];
  retireOn?: string;
  beta?: boolean;
  course?: Course;
};

const catalog: Certification[] = [
  { id: 'clf-c02', name: 'Cloud Practitioner', level: '基礎', skills: ['fundamentals'], focus: '責任共有、料金、基本サービス' },
  { id: 'aif-c01', name: 'AI Practitioner', level: '基礎', skills: ['ai'], focus: 'AIと生成AIの基礎、責任ある利用' },
  { id: 'saa-c03', name: 'Solutions Architect', level: 'アソシエイト', skills: ['architecture', 'security', 'networking', 'fundamentals'], focus: '可用性・性能・コストを満たす構成設計',
    course: {
      practice: [{ path: 'courses/saa-c03/mock-questions.json', label: 'オリジナル模試 第1回' }, { path: 'courses/saa-c03/questions.json', label: '公式サンプルの再構成問題' }],
      mock: 'courses/saa-c03/mock-questions.json',
      archives: ['courses/saa-c03/mock-questions-v1.json'],
      exam: { minutes: 130, distribution: { セキュリティ: 19, レジリエンス: 17, パフォーマンス: 16, コスト最適化: 13 } },
    },
  },
  { id: 'dva-c02', name: 'Developer', level: 'アソシエイト', skills: ['development', 'security'], focus: 'アプリ開発、デプロイ、デバッグ' },
  { id: 'soa-c03', name: 'CloudOps Engineer', level: 'アソシエイト', skills: ['operations', 'networking', 'architecture'], focus: '監視、障害対応、運用自動化' },
  { id: 'dea-c01', name: 'Data Engineer', level: 'アソシエイト', skills: ['data', 'security'], focus: 'データ取り込み・変換・運用' },
  { id: 'mla-c01', name: 'Machine Learning Engineer', level: 'アソシエイト', skills: ['ai', 'data', 'operations'], focus: 'モデルの構築・デプロイ・監視' },
  { id: 'sap-c02', name: 'Solutions Architect', level: 'プロフェッショナル', skills: ['architecture', 'networking', 'security', 'operations'], focus: '組織横断の設計、移行、複雑な構成', buildsOn: ['saa-c03'] },
  { id: 'dop-c02', name: 'DevOps Engineer', level: 'プロフェッショナル', skills: ['operations', 'development', 'security'], focus: 'CI/CD、自動化、耐障害性', buildsOn: ['dva-c02', 'soa-c03'] },
  { id: 'aip-c01', name: 'Generative AI Developer', level: 'プロフェッショナル', skills: ['ai', 'development', 'data'], focus: 'RAG、エージェント、生成AIアプリの運用', buildsOn: ['aif-c01', 'dva-c02'] },
  { id: 'scs-c03', name: 'Security', level: '専門', skills: ['security', 'architecture', 'operations'], focus: 'アクセス制御、データ保護、インシデント対応', buildsOn: ['saa-c03'] },
  { id: 'ans-c01', name: 'Advanced Networking', level: '専門', skills: ['networking', 'operations'], focus: 'ハイブリッド接続、経路、トラブルシューティング', retireOn: '2026-12-31' },
  { id: 'ai-business-strategist', name: 'AI Business Strategist', level: 'ビジネス', skills: ['ai', 'fundamentals'], focus: 'AI導入の判断、ガバナンス、事業成果', beta: true },
];

const starterCourseIds = new Set(['clf-c02', 'aif-c01', 'dva-c02', 'soa-c03', 'dea-c01', 'mla-c01', 'sap-c02', 'dop-c02', 'aip-c01', 'scs-c03', 'ans-c01', 'ai-business-strategist']);

export const certifications: Certification[] = catalog.map(certification => {
  if (certification.course || !starterCourseIds.has(certification.id)) return certification;
  const bank = 'courses/' + certification.id + '/questions.json';
  return { ...certification, course: {
    practice: [{ path: bank, label: 'オリジナル演習' }],
    mock: bank,
    archives: [],
    exam: { minutes: 12, distribution: { [certification.focus]: 6 } },
    setSize: 3,
  } };
});
