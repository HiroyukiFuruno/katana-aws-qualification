import { advancedNetworkingCourse } from './advancedNetworkingCourse.ts';
import { aiBusinessStrategistCourse } from './aiBusinessStrategistCourse.ts';
import type { Certification, Course } from './certificationTypes';
import { generativeAiDeveloperCourse } from './generativeAiDeveloperCourse.ts';
import { machineLearningEngineerCourse } from './machineLearningEngineerCourse.ts';
import { messages } from './messages.ts';
import { securitySpecialtyCourse } from './securitySpecialtyCourse.ts';

const starterCourseIds = new Set(['clf-c02', 'sap-c03']);

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

const devOpsMock = 'courses/dop-c02/full-mock-2026-11.json';

const devOpsCourse: Course = {
  practice: [{ path: devOpsMock, label: 'saaFull' }],
  mock: devOpsMock,
  archives: ['courses/dop-c02/questions.json'],
  exam: {
    minutes: 180,
    distribution: {
      SDLCの自動化: 17,
      構成管理とIaC: 13,
      レジリエントなクラウドソリューション: 11,
      モニタリングとログ記録: 11,
      インシデントとイベントへの対応: 10,
      セキュリティとコンプライアンス: 13,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};

const uniqueCounts: Record<string, number> = {
  'aif-c01': 9,
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
      : { minutes: count * 2, distribution: { [messages.ja[certification.focus]]: count } },
    fixedExamFromBlueprint: professional,
    reviewedMock: professional ? true : undefined,
    setSize: 4,
  };
}

export function withAvailableCourses(catalog: Certification[]): Certification[] {
  return catalog.map((certification) => {
    if (certification.course) return certification;
    if (certification.id === 'dea-c01') return { ...certification, course: dataEngineerCourse };
    if (certification.id === 'dop-c02') return { ...certification, course: devOpsCourse };
    if (certification.id === 'scs-c03') return { ...certification, course: securitySpecialtyCourse };
    if (certification.id === 'ans-c01') return { ...certification, course: advancedNetworkingCourse };
    if (certification.id === 'mla-c01') {
      return { ...certification, course: machineLearningEngineerCourse };
    }
    if (certification.id === 'aip-c01') return { ...certification, course: generativeAiDeveloperCourse };
    if (certification.id === 'ai-business-strategist') {
      return { ...certification, course: aiBusinessStrategistCourse };
    }
    if (starterCourseIds.has(certification.id)) {
      return { ...certification, course: starterCourse(certification) };
    }
    return certification;
  });
}
