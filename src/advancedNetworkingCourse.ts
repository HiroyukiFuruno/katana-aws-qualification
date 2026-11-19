import type { Course } from './certificationTypes';

const mock = 'courses/ans-c01/full-mock-2026-11.json';

export const advancedNetworkingCourse: Course = {
  practice: [{ path: mock, label: 'saaFull' }],
  mock,
  archives: ['courses/ans-c01/questions.json', 'courses/ans-c01/mock-2026-11.json'],
  examStorageId: 'ans-c01',
  exam: {
    minutes: 170,
    distribution: {
      ネットワーク設計: 19,
      ネットワーク実装: 17,
      ネットワーク管理と運用: 13,
      'ネットワークセキュリティ・コンプライアンス・ガバナンス': 16,
    },
  },
  fixedExamFromBlueprint: true,
  reviewedMock: true,
};
