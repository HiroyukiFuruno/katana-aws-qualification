type QualificationLearningCase = {
  courseId: string;
  firstTitle: string;
  nextUnit: string;
  prompt: RegExp;
  answer: RegExp;
  choiceCount: number;
  figureInNextUnit?: boolean;
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
];
