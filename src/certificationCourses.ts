import type { Certification, Course } from './certificationTypes';

const starterCourseIds = new Set([
  'clf-c02',
  'mla-c01',
  'sap-c03',
  'dop-c02',
  'aip-c01',
  'scs-c03',
  'ans-c01',
  'ai-business-strategist',
]);

const developerMock = 'courses/dva-c03/mock-2026-11.json';

export const developerCourse: Course = {
  practice: [{ path: developerMock, label: 'saaFull' }],
  mock: developerMock,
  archives: ['courses/dva-c02/questions.json', 'courses/dva-c02/mock-2026-11.json'],
  examStorageId: 'dva-c02',
  exam: {
    minutes: 130,
    distribution: {
      AWSサービスでの開発: 20,
      セキュリティ: 17,
      テストとデプロイ: 14,
      トラブルシューティングと最適化: 14,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};

const cloudOpsMock = 'courses/soa-c03/full-mock-2026-11.json';

export const cloudOpsCourse: Course = {
  practice: [{ path: cloudOpsMock, label: 'saaFull' }],
  mock: cloudOpsMock,
  archives: ['courses/soa-c03/questions.json'],
  exam: {
    minutes: 130,
    distribution: {
      '監視・分析・修復と性能最適化': 14,
      信頼性と事業継続: 14,
      'デプロイ・プロビジョニングと自動化': 14,
      セキュリティとコンプライアンス: 11,
      ネットワークとコンテンツ配信: 12,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};

const dataEngineerMock = 'courses/dea-c01/full-mock-2026-11.json';

const dataEngineerCourse: Course = {
  practice: [{ path: dataEngineerMock, label: 'saaFull' }],
  mock: dataEngineerMock,
  archives: ['courses/dea-c01/questions.json'],
  exam: {
    minutes: 130,
    distribution: {
      データの取り込みと変換: 22,
      データストア管理: 17,
      データ運用とサポート: 14,
      データセキュリティとガバナンス: 12,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};

const uniqueCounts: Record<string, number> = {
  'aif-c01': 9,
  'aip-c01': 9,
  'dop-c02': 9,
  'mla-c01': 9,
  'scs-c03': 9,
};

function starterCourse(certification: Certification): Course {
  const legacyId = certification.id === 'sap-c03' ? 'sap-c02' : certification.id;
  const mock = `courses/${certification.id}/mock-2026-11.json`;
  const professional = certification.id === 'sap-c03';
  const count = uniqueCounts[certification.id] ?? 10;

  return {
    practice: [{ path: mock, label: professional ? 'saaFull' : 'shortExam' }],
    mock,
    archives: [`courses/${legacyId}/questions.json`],
    examStorageId: legacyId,
    exam: professional
      ? {
          minutes: 180,
          distribution: {
            クラウドアーキテクチャ: 19,
            'セキュリティ・コンプライアンス・ガバナンス': 19,
            コスト最適化: 11,
            'レジリエンス・移行・事業継続': 11,
            '運用上の優秀性・自動化': 15,
          },
        }
      : { minutes: count * 2, distribution: { [certification.focus]: count } },
    fixedExamFromBlueprint: professional,
    reviewedMock: professional ? true : undefined,
    setSize: 4,
  };
}

export function withAvailableCourses(catalog: Certification[]): Certification[] {
  return catalog.map((certification) => {
    if (certification.course) return certification;
    if (certification.id === 'dea-c01') return { ...certification, course: dataEngineerCourse };
    if (starterCourseIds.has(certification.id)) {
      return { ...certification, course: starterCourse(certification) };
    }
    return certification;
  });
}
